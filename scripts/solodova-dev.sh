#!/usr/bin/env bash
# Полный локальный bootstrap Solodova: infra → migrate → seed → mobile tenant → dev stack.
#
# Usage:
#   ./scripts/solodova-dev.sh           # API + mobile (Metro)
#   ./scripts/solodova-dev.sh --admin   # API + admin panel
#   ./scripts/solodova-dev.sh --check   # только smoke (infra + API должны быть уже up)
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE=stack
if [[ "${1:-}" == "--admin" ]]; then
  MODE=admin
elif [[ "${1:-}" == "--check" ]]; then
  MODE=check
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi

echo "==> Solodova dev: activate mobile tenant"
bash scripts/mobile-tenant.sh use solodova

if [[ "$MODE" != "check" ]]; then
  if ! docker info >/dev/null 2>&1; then
    echo "solodova-dev: Docker не запущен. Откройте Docker Desktop и повторите." >&2
    exit 1
  fi

  echo "==> Solodova dev: docker compose up"
  docker compose up -d
  node scripts/wait-for-infra.cjs

  echo "==> Solodova dev: prisma generate + migrate"
  pnpm --filter @srs/api exec prisma generate
  pnpm --filter @srs/api exec prisma migrate deploy

  echo "==> Solodova dev: seed (сеть Solodova Recovery System Москва + демо-данные)"
  DEV_ADMIN_EMAIL="${DEV_ADMIN_EMAIL:-admin@solodova-recovery.local}" \
  DEV_ADMIN_PASSWORD="${DEV_ADMIN_PASSWORD:-DevAdminChangeMe!}" \
  DEV_ADMIN_PHONE="${DEV_ADMIN_PHONE:-+79000000000}" \
    pnpm --filter @srs/api prisma:seed

  echo "==> Solodova dev: ensure SUPER_ADMIN"
  pnpm bootstrap:dev-admin || true
fi

echo "==> Solodova dev: smoke"
if ! curl -sf "http://127.0.0.1:${API_PORT:-3000}/api/v1/health/live" >/dev/null 2>&1; then
  echo "solodova-dev: API ещё не слушает :${API_PORT:-3000} — запустите dev:stack в другом терминале или дождитесь старта" >&2
else
  BASE_URL="http://127.0.0.1:${API_PORT:-3000}" ./scripts/staging-smoke.sh || true
fi

if [[ "$MODE" == "check" ]]; then
  echo "solodova-dev: check complete"
  exit 0
fi

echo ""
echo "Solodova готов к разработке:"
echo "  Admin:  admin@solodova-recovery.local / ${DEV_ADMIN_PASSWORD:-DevAdminChangeMe!}"
echo "  API:    http://localhost:${API_PORT:-3000}/api/v1"
echo "  Mobile: tenant solodova, Metro ниже"
echo ""

if [[ "$MODE" == "admin" ]]; then
  exec pnpm dev:stack:admin
else
  exec pnpm dev:stack
fi
