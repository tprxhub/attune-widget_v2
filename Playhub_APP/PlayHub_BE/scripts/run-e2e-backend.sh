#!/bin/sh
set -eu

E2E_DB_FILE="$(mktemp /tmp/playhub-e2e-db-XXXXXX)"
E2E_UPLOAD_DIR="$(mktemp -d /tmp/playhub-e2e-uploads-XXXXXX)"

cleanup() {
  rm -f "$E2E_DB_FILE"
  rm -rf "$E2E_UPLOAD_DIR"
}
trap cleanup EXIT INT TERM

export DATABASE_URL="sqlite:///$E2E_DB_FILE"
export STORAGE_BACKEND="local"
export STORAGE_LOCAL_ROOT="$E2E_UPLOAD_DIR"
export ENVIRONMENT="test"
export JWT_SECRET="e2e-secret-that-is-long-enough-for-hs256"
export ENABLE_TEST_PERSONAS="true"
export CORS_ORIGINS="http://127.0.0.1:4174"

.venv/bin/python -m app.seed
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8765
