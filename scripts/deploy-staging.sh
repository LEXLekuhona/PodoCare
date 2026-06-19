#!/usr/bin/env bash
# Deploy API + admin on staging VPS (Docker prod stack).
# Run on the server after `git pull`, or invoked by `.github/workflows/deploy-staging.yml`.
#
# Env:
#   DEPLOY_ROOT   — repo path on VPS (default: /root/PodoCare)
#   GIT_BRANCH    — branch to deploy (default: main)
#   NO_CACHE_API  — if "1", rebuild api image with --no-cache

set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/root/PodoCare}"
GIT_BRANCH="${GIT_BRANCH:-main}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
HEALTH_RETRIES="${HEALTH_RETRIES:-36}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"

cd "$DEPLOY_ROOT"

if [[ ! -f .env ]]; then
  echo "deploy-staging: missing .env in ${DEPLOY_ROOT}" >&2
  exit 1
fi

# Compose and smoke read the same runtime env as manual deploy.
set -a
# shellcheck disable=SC1091
source ./.env
set +a

ADMIN_PORT="${ADMIN_HTTP_PORT:-8080}"

if [[ "${VITE_API_URL:-}" == *localhost* ]]; then
  echo "deploy-staging: warning — VITE_API_URL still points at localhost; admin build may be wrong on VPS" >&2
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "deploy-staging: pnpm not found in PATH" >&2
  exit 1
fi

echo "==> deploy-staging: ${DEPLOY_ROOT} @ ${GIT_BRANCH}"

echo "==> git fetch / pull"
git fetch origin "$GIT_BRANCH"
git checkout "$GIT_BRANCH"
git pull --ff-only origin "$GIT_BRANCH"

if [[ "${NO_CACHE_API:-0}" == "1" ]]; then
  echo "==> docker build api (--no-cache)"
  "${COMPOSE[@]}" build --no-cache api
fi

echo "==> docker up (build + recreate api, admin)"
pnpm docker:up:prod

echo "==> wait for API health/live"
ready=0
for _ in $(seq 1 "$HEALTH_RETRIES"); do
  if curl -sf "http://127.0.0.1:3000/api/v1/health/live" >/dev/null; then
    ready=1
    break
  fi
  sleep "$HEALTH_INTERVAL"
done

if [[ "$ready" != "1" ]]; then
  echo "deploy-staging: API did not become healthy in time" >&2
  docker logs srs-api --tail 80 2>/dev/null || true
  exit 1
fi

echo "==> staging smoke (infrastructure + business minimum)"
chmod +x scripts/staging-smoke.sh
BASE_URL="http://127.0.0.1:3000" ADMIN_URL="http://127.0.0.1:${ADMIN_PORT}" ./scripts/staging-smoke.sh

echo "==> containers"
"${COMPOSE[@]}" ps

echo "deploy-staging: OK"
