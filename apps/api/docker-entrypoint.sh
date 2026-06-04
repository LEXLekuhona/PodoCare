#!/bin/sh
set -e

cd /app/apps/api

# Symlink workspace-пакета после COPY в образе иногда битый — подкладываем копию из /app/packages.
if [ ! -r node_modules/@srs/shared-types/dist/index.js ]; then
  echo "Repairing @srs/shared-types in node_modules..."
  rm -rf node_modules/@srs/shared-types
  mkdir -p node_modules/@srs
  cp -a ../../packages/shared-types node_modules/@srs/shared-types
fi

echo "Checking runtime dependencies..."
node -e "require.resolve('@srs/shared-types'); require('@srs/shared-types'); require('@prisma/client'); console.log('Runtime deps OK')"

if [ "${RUN_DB_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying Prisma migrations..."
  pnpm exec prisma migrate deploy
fi

if [ -f "dist/main.js" ]; then
  exec node dist/main.js
fi

# В этой репе tsconfig rootDir = "./", поэтому Nest build кладёт entrypoint в dist/src/main.js.
exec node dist/src/main.js
