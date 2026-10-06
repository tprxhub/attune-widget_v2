# Play Hub API

FastAPI backend for Play Hub. The React frontend in `../PlayHub_FE` consumes this API through
`VITE_API_URL`.

## Run locally

```bash
cd PlayHub_BE
python3.12 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Python 3.12 or newer is required. If the existing `.venv` was created with an older
Python version, recreate it before installing `requirements.txt`; current security-fixed
FastAPI and Starlette releases no longer support Python 3.9.

Open `http://localhost:8000/docs` for the API contract. Seed credentials are `admin@playhub.local` / `ChangeMe123!`; change them immediately outside local development.

`tester@playhub.local` / `ChangeMe123!` is the dedicated development tester.
It can call `GET /api/v1/developer/personas` and then `POST
/api/v1/developer/personas/{persona_id}/switch` to receive a token for another
seeded persona. These endpoints are disabled automatically in production.

## Demo data

`python -m app.seed` is additive and idempotent: it preserves existing records and fills in a
realistic local dataset with 2 organisations, 3 Play Plans, 9 Play Doses, 36 activities, 6
children, subscriptions, progress histories and a pending invitation. All demo accounts use
`ChangeMe123!`:

| Persona | Email |
| --- | --- |
| Platform Admin | `admin@playhub.local` |
| Test persona switcher | `tester@playhub.local` |
| Organisation Admin | `esther@sunrise.local` |
| Organisation Moderator | `moderator@playhub.local` |
| Organisation parent | `hana@sunrise.local` |
| Subscribed family | `parent@playhub.local` |
| Free family | `free.parent@playhub.local` |

After starting the API, verify the seeded role/data paths with:

```bash
python scripts/smoke_seeded_api.py --base-url http://127.0.0.1:8000
```

## Domain rules

- **Play Plan** is the skill goal, such as Pinch & Grip Development.
- **Play Dose** is one level-specific programme within a Play Plan.
- **Activity** belongs to one Play Dose and has one optional video source (upload or external link) plus written instructions.
- Attempts are append-only records; they are never overwritten.
- Organisation and individual accounts can be created through a time-limited
  invitation workflow. The creation response exposes the one-time activation
  token to the authenticated creator; invitation list responses never expose it.
  The recipient chooses their password, so readable passwords are never stored.
  Audit events record sensitive administrative actions.

## Tests

```bash
pytest
```

The suite covers API authentication and role boundaries, organisation suspension, child ownership
and assignments, subscription enforcement, Check-In validation, authoritative progress metrics,
invitations, catalog management, uploads, audit events, and storage behavior. The frontend's
`bun run test:e2e` adds browser-level verification against an isolated seeded instance of this API.

Progress is calculated from append-only Attempts. The summary Support Score is the most recent
session's help level: independent is 0, one reminder is 33, a few reminders is 67, and hands-on
help is 100. Weekly chart points continue to average those values across the week's kit sessions.
`check_in_count`, distinct activities, last Check-In, and the individual chart points all come from
the backend response so every client uses the same result.

Use PostgreSQL through `DATABASE_URL` in hosted environments, change `JWT_SECRET`, and run `alembic upgrade head`. Local upload storage is intentionally for development only; use object storage before production.

The service exposes `/health` for liveness and `/ready` for a database-backed readiness check.

## Authentication and Google sign-in

Password authentication and Google Identity Services both exchange for the same short-lived Play
Hub bearer token. Tokens validate signature, expiry, issuer and audience; every protected request
then reloads the user and organisation status from the database before applying role and child
scope checks.

Google sign-in links an existing Play Hub account only. It never creates a family, child or
privileged account from untrusted profile data. Automatic first-time linking is limited to Gmail
and Google Workspace addresses for which Google is authoritative.

1. Create a Google OAuth **Web application** client.
2. Add the frontend origins (for example `http://localhost:3000` and the production HTTPS origin)
   to Authorized JavaScript origins.
3. Set the same client ID as `GOOGLE_CLIENT_ID` in `PlayHub_BE/.env` and
   `VITE_GOOGLE_CLIENT_ID` in `PlayHub_FE/.env`.
4. Restart both services. No Google client secret is needed for the browser ID-token flow.

## Stripe Checkout

Individual plans are fixed-term, one-time GBP purchases (£39/£69/£119). The browser requests a
hosted Checkout Session and redirects to Stripe. Returning to the success URL does **not** unlock
content: only a signed `checkout.session.completed` or
`checkout.session.async_payment_succeeded` webhook with the expected amount, currency and metadata
creates the entitlement. Processed event IDs and Checkout Session IDs make fulfillment idempotent.

Configure the backend:

```dotenv
FRONTEND_BASE_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

For local webhook delivery, use the Stripe CLI:

```bash
stripe listen --forward-to http://localhost:8000/api/v1/billing/webhook
```

Copy the CLI's `whsec_...` value into `.env`, restart the API, and use Stripe test mode. A family
owner can request a full Stripe refund during the seven-day refund window; organisation children
remain billed by license. Run `alembic upgrade head` before starting a deployment.

## Media storage: local and S3

The upload endpoints always create immutable object keys under `media/thumbnails/` or
`media/videos/`. In normal local development, `STORAGE_BACKEND=local` stores those objects under
`uploads/` and serves them at `/uploads/...`. The frontend needs no special-case code: API-relative
local URLs and absolute CDN production URLs are both supported.

To point a development API at AWS S3 (or another S3-compatible provider), copy
`.env.s3.example` to `.env`, fill in the bucket, region and public URL, then provide credentials
through the standard AWS environment variables or credential files. `STORAGE_BACKEND=s3` is the
deliberate switch; changing credentials alone does not silently move uploads. The API validates
the complete S3 configuration at startup and reports bucket connectivity through `/ready`.
When a development environment switches from local storage to S3, new files go to S3 while
existing `/uploads/...` files remain readable and are still removed when replaced. This is a
development convenience, not a production migration mechanism.

To test the real S3 code path locally, run the included PostgreSQL + MinIO stack:

```bash
docker compose up --build
```

MinIO's S3 endpoint is `http://localhost:9000` and its console is
`http://localhost:9001`. The compose-only credentials are `playhub-local` /
`playhub-local-secret`. The bucket is public-read only for local browser testing; do not copy that
policy to AWS.

For production, use a private S3 bucket and a CloudFront distribution with Origin Access Control.
Configure:

```dotenv
ENVIRONMENT=production
STORAGE_BACKEND=s3
S3_BUCKET_NAME=playhub-production-media
S3_REGION=ap-south-1
STORAGE_PUBLIC_BASE_URL=https://media.example.com
STORAGE_KEY_PREFIX=media
S3_SERVER_SIDE_ENCRYPTION=AES256
```

Do not put AWS keys in the application `.env`; attach an ECS task, EC2 instance, or other workload
IAM role. The API role needs `s3:ListBucket` on the bucket (for readiness) and `s3:PutObject` /
`s3:DeleteObject` on the configured prefix. CloudFront, not the API role, should receive read access.
Uploaded files are size-limited, extension/MIME/signature checked, encrypted server-side, served with
immutable cache metadata, and removed when they are replaced or their owning record is deleted.
