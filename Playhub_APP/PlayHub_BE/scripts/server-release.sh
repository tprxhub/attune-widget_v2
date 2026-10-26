#!/bin/bash
# Runs ON the backend server (as root) to release one version of the API in place, without
# downtime. Called by scripts/deploy.sh from a developer machine; also used for the very first
# release when a server is built.
#
#   server-release.sh <version> <backend.tgz>
#
# Two container slots take turns: playhub_be_a (port 8000) and playhub_be_b (port 8001). Caddy
# sends traffic to whichever is healthy (8000 first), so the new version starts beside the old
# one, takes over once it answers /ready, and only then is the old one stopped.
#
# Migrations run before the switch while the old version is still serving, so a migration must
# keep working with the version that is live (add columns, don't drop them in the same release).
# The seed only adds missing content; it never changes existing data.
set -euo pipefail

VERSION="${1:?version (commit) to release}"
BUNDLE="${2:?path to the backend .tgz}"
ROOT=/opt/playhub
ENV_FILE="$ROOT/.env"
DATA=/opt/playhub-data
RELEASE="$ROOT/releases/$VERSION"
KEEP=3

[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE"; exit 1; }

echo "== unpack $VERSION"
rm -rf "$RELEASE" && mkdir -p "$RELEASE"
tar xzf "$BUNDLE" -C "$RELEASE"
find "$RELEASE" -name '._*' -delete

echo "== build image"
docker build -q -t "playhub-be:$VERSION" "$RELEASE"

run_once() { docker run --rm --env-file "$ENV_FILE" -v "$DATA:/data" "playhub-be:$VERSION" "$@"; }
echo "== migrate"
run_once python -m alembic upgrade head
echo "== seed (adds missing content only)"
run_once python -m app.seed

if docker ps --format '{{.Names}}' | grep -qx playhub_be_a; then
  OLD=playhub_be_a; NEW=playhub_be_b; PORT=8001
else
  OLD=playhub_be_b; NEW=playhub_be_a; PORT=8000
fi

echo "== start $NEW on :$PORT"
docker rm -f "$NEW" >/dev/null 2>&1 || true
docker run -d --name "$NEW" --restart unless-stopped --env-file "$ENV_FILE" -v "$DATA:/data" \
  -p "127.0.0.1:$PORT:8000" "playhub-be:$VERSION" >/dev/null

ready=""
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:$PORT/ready" >/dev/null; then ready=1; break; fi
  sleep 2
done
if [ -z "$ready" ]; then
  echo "!! $NEW never became ready; keeping $OLD live"
  docker logs --tail 60 "$NEW" || true
  docker rm -f "$NEW" >/dev/null 2>&1 || true
  exit 1
fi

# Caddy's health check (every 3s) must see the new slot before the old one goes away.
sleep 8
if docker ps -a --format '{{.Names}}' | grep -qx "$OLD"; then
  echo "== stop $OLD"
  docker stop -t 25 "$OLD" >/dev/null && docker rm "$OLD" >/dev/null
fi

# Pick up Caddy config changes shipped with the release (validated before reloading).
if [ -f "$RELEASE/scripts/Caddyfile" ] && ! cmp -s "$RELEASE/scripts/Caddyfile" /opt/caddy/Caddyfile; then
  echo "== update Caddy config"
  cp /opt/caddy/Caddyfile /opt/caddy/Caddyfile.previous
  cp "$RELEASE/scripts/Caddyfile" /opt/caddy/Caddyfile
  if docker exec caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
    docker exec caddy caddy reload --config /etc/caddy/Caddyfile
  else
    echo "!! new Caddyfile is invalid; keeping the previous one"
    cp /opt/caddy/Caddyfile.previous /opt/caddy/Caddyfile
  fi
fi

echo "$VERSION" > "$ROOT/CURRENT"
echo "$(date -u +%FT%TZ) $VERSION" >> "$ROOT/releases.log"

# Keep the last few releases and images for a quick rollback; remove older ones.
ls -1t "$ROOT/releases" | tail -n +$((KEEP + 1)) | while read -r old; do rm -rf "${ROOT:?}/releases/$old"; done
docker images playhub-be --format '{{.Tag}}' | grep -vx "$VERSION" | tail -n +$KEEP \
  | while read -r tag; do docker rmi "playhub-be:$tag" >/dev/null 2>&1 || true; done
docker image prune -f >/dev/null 2>&1 || true

echo "RELEASED $VERSION on $NEW"
