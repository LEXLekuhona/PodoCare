#!/usr/bin/env bash
# Post-deploy smoke for staging (docs/infrastructure-and-operations.md §3 + business minimum).
#
# Usage:
#   ./scripts/staging-smoke.sh
#   BASE_URL=http://127.0.0.1:3000 ADMIN_URL=http://127.0.0.1:8080 ./scripts/staging-smoke.sh
#
# Optional (business smoke — staff login + protected read):
#   STAFF_SMOKE_EMAIL / STAFF_SMOKE_PASSWORD
#   or DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD from sourced .env
#
# Exit 0 only when all checks pass.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
ADMIN_URL="${ADMIN_URL:-http://127.0.0.1:${ADMIN_HTTP_PORT:-8080}}"
API_PREFIX="${API_GLOBAL_PREFIX:-api/v1}"
STAFF_EMAIL="${STAFF_SMOKE_EMAIL:-${DEV_ADMIN_EMAIL:-}}"
STAFF_PASSWORD="${STAFF_SMOKE_PASSWORD:-${DEV_ADMIN_PASSWORD:-}}"

for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "staging-smoke: need ${cmd} in PATH" >&2
    exit 2
  fi
done

api() {
  local path="$1"
  echo "${BASE_URL%/}/${API_PREFIX}/${path#/}"
}

pass() {
  echo "staging-smoke: OK — $*"
}

fail() {
  echo "staging-smoke: FAIL — $*" >&2
  exit 1
}

echo "==> staging-smoke BASE_URL=${BASE_URL} ADMIN_URL=${ADMIN_URL}"

# 1) Liveness
live_body="$(curl -sf "$(api health/live)")"
live_status="$(jq -r '.status // empty' <<<"$live_body")"
[[ "$live_status" == "ok" ]] || fail "health/live status=${live_status:-?}"
pass "health/live"

# 2) Dependencies + queues up
health_body="$(curl -sf "$(api health)")"
for key in postgres redis notificationsQueue appointmentsQueue; do
  up="$(jq -r ".info.${key}.status // .details.${key}.status // empty" <<<"$health_body")"
  [[ "$up" == "up" ]] || fail "health ${key}=${up:-?}"
done
pass "health dependencies and queues"

# 3) health/queues thresholds
if [[ -x scripts/health-queues-synthetic-check.sh ]]; then
  BASE_URL="$BASE_URL" scripts/health-queues-synthetic-check.sh
  pass "health/queues synthetic"
else
  queues_body="$(curl -sf "$(api health/queues)")"
  qstatus="$(jq -r '.status // empty' <<<"$queues_body")"
  [[ "$qstatus" == "ok" || "$qstatus" == "warn" ]] || fail "health/queues status=${qstatus:-?}"
  pass "health/queues status=${qstatus}"
fi

# 4) X-Request-Id
rid="staging-smoke-$(date +%s)"
headers="$(curl -sS -D - -o /dev/null "$(api health/live)" -H "X-Request-Id: ${rid}")"
echo "$headers" | grep -qi "x-request-id: ${rid}" || fail "missing X-Request-Id echo"
pass "X-Request-Id"

# 5) Admin static
admin_health="$(curl -sf "${ADMIN_URL%/}/health")"
[[ "$admin_health" == "ok" ]] || fail "admin /health=${admin_health:-?}"
pass "admin /health"

# 6) Auth contract on protected endpoint
code="$(curl -sS -o /dev/null -w '%{http_code}' "$(api appointments)")"
[[ "$code" == "401" ]] || fail "GET appointments without token HTTP ${code} (expected 401)"
pass "appointments 401 without token"

# 7) Business smoke (staff read path)
if [[ -n "$STAFF_EMAIL" && -n "$STAFF_PASSWORD" ]]; then
  login_tmp="$(mktemp)"
  login_code="$(curl -sS -o "$login_tmp" -w '%{http_code}' \
    -X POST "$(api auth/staff/login)" \
    -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg email "$STAFF_EMAIL" --arg password "$STAFF_PASSWORD" \
      '{email:$email,password:$password,deviceType:"admin_web"}')")"
  [[ "$login_code" == "201" ]] || fail "staff login HTTP ${login_code}"
  token="$(jq -r '.tokens.accessToken // empty' <"$login_tmp")"
  rm -f "$login_tmp"
  [[ -n "$token" ]] || fail "staff login missing accessToken"

  appt_code="$(curl -sS -o /dev/null -w '%{http_code}' \
    "$(api appointments)" -H "Authorization: Bearer ${token}")"
  [[ "$appt_code" == "200" ]] || fail "GET appointments HTTP ${appt_code} (expected 200)"

  nets_code="$(curl -sS -o /dev/null -w '%{http_code}' \
    "$(api admin/catalog/networks)" -H "Authorization: Bearer ${token}")"
  [[ "$nets_code" == "200" ]] || fail "GET admin/catalog/networks HTTP ${nets_code} (expected 200)"

  pass "staff login + appointments list + admin/catalog/networks"
else
  echo "staging-smoke: skip staff business smoke (set DEV_ADMIN_EMAIL/PASSWORD or STAFF_SMOKE_*)" >&2
fi

echo "staging-smoke: all checks passed"
