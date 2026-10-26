#!/bin/bash
# Release the backend to the live server in place (no downtime). Run from a developer machine:
#
#   Playhub_APP/PlayHub_BE/scripts/deploy.sh [git-ref]        # default: HEAD (committed code only)
#   Playhub_APP/PlayHub_BE/scripts/deploy.sh --refresh-env    # also re-download .env from the deploy bucket
#
# Needs: the SSH key (default ~/.ssh/playhub-backend-key.pem), the AWS CLI profile "playhub", and
# your IP allowed on port 22 of the backend security group (the script checks and tells you how).
# Rollback = run it again with the previous commit.
set -euo pipefail

HOST="${PLAYHUB_HOST:-16-192-12-132.sslip.io}"
KEY="${PLAYHUB_SSH_KEY:-$HOME/.ssh/playhub-backend-key.pem}"
AWS_ARGS=(--profile "${AWS_PROFILE_NAME:-playhub}" --region eu-north-1)
SG=sg-06260a729b0f16b40
BUCKET=playhub-deploy-121014832711
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "ec2-user@$HOST")

REFRESH_ENV=""
REF=HEAD
for arg in "$@"; do
  case "$arg" in
    --refresh-env) REFRESH_ENV=1 ;;
    *) REF="$arg" ;;
  esac
done

REPO="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
VERSION="$(git -C "$REPO" rev-parse --short "$REF")"
[ -f "$KEY" ] || { echo "SSH key not found: $KEY"; exit 1; }

MYIP="$(curl -s https://checkip.amazonaws.com)"
if ! aws "${AWS_ARGS[@]}" ec2 describe-security-groups --group-ids "$SG" \
    --query "SecurityGroups[0].IpPermissions[?FromPort==\`22\`].IpRanges[].CidrIp" --output text | grep -qw "$MYIP/32"; then
  echo "Your IP $MYIP is not allowed on port 22. Allow it with:"
  echo "  aws ${AWS_ARGS[*]} ec2 authorize-security-group-ingress --group-id $SG --ip-permissions 'IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=$MYIP/32,Description=playhub-deploy}]'"
  echo "(and revoke the old address with revoke-security-group-ingress)"
  exit 1
fi

if [ -n "$(git -C "$REPO" status --porcelain -- Playhub_APP/PlayHub_BE)" ] && [ "$REF" = HEAD ]; then
  echo "note: uncommitted backend changes are NOT deployed; only commit $VERSION is."
fi

BUNDLE="$(mktemp -t playhub-be).tgz"
trap 'rm -f "$BUNDLE"' EXIT
git -C "$REPO" archive --format=tar.gz -o "$BUNDLE" "$REF:Playhub_APP/PlayHub_BE"
echo "== copy $VERSION ($(du -h "$BUNDLE" | cut -f1))"
scp -q -i "$KEY" -o StrictHostKeyChecking=accept-new "$BUNDLE" "ec2-user@$HOST:/tmp/playhub-$VERSION.tgz"

if [ -n "$REFRESH_ENV" ]; then
  echo "== refresh .env from s3://$BUCKET/deploy/.env"
  URL="$(aws "${AWS_ARGS[@]}" s3 presign "s3://$BUCKET/deploy/.env" --expires-in 300)"
  "${SSH[@]}" "sudo sh -c 'curl -fsSL \"\$1\" -o /opt/playhub/.env.new && chmod 600 /opt/playhub/.env.new && mv /opt/playhub/.env.new /opt/playhub/.env' _ '$URL'"
fi

echo "== release on server"
"${SSH[@]}" "sudo tar xzf /tmp/playhub-$VERSION.tgz -O scripts/server-release.sh > /tmp/server-release.sh && sudo bash /tmp/server-release.sh $VERSION /tmp/playhub-$VERSION.tgz && rm -f /tmp/playhub-$VERSION.tgz"

echo "== check https://$HOST/ready"
for _ in $(seq 1 15); do
  if curl -sf "https://$HOST/ready" >/dev/null; then echo "LIVE $VERSION"; exit 0; fi
  sleep 2
done
echo "!! /ready is not answering through Caddy"; exit 1
