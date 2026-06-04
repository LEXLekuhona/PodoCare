#!/bin/sh
set -e

cd /app/apps/api

echo "Checking runtime dependencies..."
node -e "\
  const { createRequire } = require('module'); \
  const req = createRequire('/app/apps/api/dist/src/modules/auth/application/auth.service.js'); \
  req.resolve('@srs/shared-types'); \
  req('@srs/shared-types'); \
  require('@prisma/client'); \
  console.log('Runtime deps OK'); \
"

if [ "${RUN_DB_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying Prisma migrations..."
  pnpm exec prisma migrate deploy
fi

if [ -f "dist/main.js" ]; then
  exec node dist/main.js
fi

# В этой репе tsconfig rootDir = "./", поэтому Nest build кладёт entrypoint в dist/src/main.js.
exec node dist/src/main.js
