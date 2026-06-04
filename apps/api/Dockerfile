# syntax=docker/dockerfile:1

FROM node:22.12-alpine AS build

RUN apk add --no-cache python3 make g++
RUN npm install -g pnpm@10.33.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY docker/npm.ci.rc ./docker/npm.ci.rc
COPY apps/admin/package.json ./apps/admin/
COPY apps/api/package.json ./apps/api/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/

ARG NPM_REGISTRY=https://registry.npmjs.org/
RUN cat docker/npm.ci.rc >> .npmrc \
  && pnpm config set registry "$NPM_REGISTRY" \
  && pnpm install --frozen-lockfile --filter @srs/api...

COPY packages/shared-types ./packages/shared-types
COPY packages/tsconfig ./packages/tsconfig
COPY apps/api ./apps/api

RUN pnpm --filter @srs/shared-types build \
  && pnpm --filter @srs/api exec prisma generate \
  && pnpm --filter @srs/api build

FROM node:22.12-alpine AS runtime

RUN apk add --no-cache openssl \
  && npm install -g pnpm@10.33.0

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/scripts ./apps/api/scripts
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
# pnpm кладёт workspace-зависимости в apps/api/node_modules (@srs/shared-types → ../../../../packages/shared-types).
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/shared-types/package.json ./packages/shared-types/package.json

COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /app/apps/api
RUN node -e "require('@srs/shared-types'); require('@prisma/client'); console.log('build smoke: runtime deps OK')"

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3000)+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
