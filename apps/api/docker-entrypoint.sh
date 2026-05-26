#!/bin/sh
set -e

cd /app/apps/api

if [ "${RUN_DB_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying Prisma migrations..."
  pnpm exec prisma migrate deploy
fi

exec node dist/main.js
