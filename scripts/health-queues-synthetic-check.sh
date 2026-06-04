#!/usr/bin/env bash
# Synthetic GET /api/v1/health/queues for staging/prod alerting (cron, GitHub Actions, k8s Job).
#
# Usage:
#   ./scripts/health-queues-synthetic-check.sh https://api.example.com
#   BASE_URL=https://api.example.com ./scripts/health-queues-synthetic-check.sh
#
# Accepts either API base (https://host) or full URL containing /api/v1/health/queues.
#
# Exit codes:
#   0 — HTTP 200 and JSON status is "ok"
#   1 — HTTP 200 and JSON status is "warn"
#   2 — HTTP non-200, JSON status is "critical", invalid body, or curl/jq missing
#   3 — missing URL (no arg and no BASE_URL)

set -euo pipefail

for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "health-queues-synthetic-check: need ${cmd} in PATH" >&2
    exit 2
  fi
done

raw="${1:-}"
if [[ -z "$raw" ]]; then
  raw="${BASE_URL:-}"
fi
if [[ -z "$raw" ]]; then
  echo "usage: $0 <base-or-full-url>" >&2
  echo "   or: BASE_URL=https://api.example.com $0" >&2
  exit 3
fi

if [[ "$raw" == *"/api/v1/health/queues"* ]]; then
  url="$raw"
else
  url="${raw%/}/api/v1/health/queues"
fi

tmp="$(mktemp "${TMPDIR:-/tmp}/hq.XXXXXX")"
cleanup() {
  rm -f "$tmp"
}
trap cleanup EXIT

if ! http_code="$(curl -sS -o "$tmp" -w '%{http_code}' "$url")"; then
  echo "health-queues-synthetic-check: request failed for $url" >&2
  exit 2
fi

if [[ "$http_code" != "200" ]]; then
  echo "health-queues-synthetic-check: HTTP $http_code for $url" >&2
  exit 2
fi

status="$(jq -r '.status // "invalid"' <"$tmp")"

case "$status" in
ok)
  exit 0
  ;;
warn)
  echo "health-queues-synthetic-check: status=warn ($url)" >&2
  exit 1
  ;;
critical)
  echo "health-queues-synthetic-check: status=critical ($url)" >&2
  exit 2
  ;;
*)
  echo "health-queues-synthetic-check: unexpected status=${status:-?} ($url)" >&2
  exit 2
  ;;
esac
