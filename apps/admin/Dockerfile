# syntax=docker/dockerfile:1

# Сборка статики админки (React + Vite). URL API задаётся на этапе build (ARG VITE_API_URL).
FROM node:22.12-alpine AS build

# Corepack в node:22-alpine иногда не проходит проверку подписи pnpm — ставим напрямую.
RUN npm install -g pnpm@10.33.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# frozen-lockfile требует package.json всех workspace-пакетов из lockfile.
COPY apps/admin/package.json ./apps/admin/
COPY apps/api/package.json ./apps/api/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN pnpm install --frozen-lockfile --filter @srs/admin...

COPY packages/shared-types ./packages/shared-types
COPY packages/tsconfig ./packages/tsconfig
COPY apps/admin ./apps/admin

ARG VITE_API_URL=http://localhost:3000/api/v1
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm --filter @srs/admin build

FROM nginx:1.27-alpine AS runtime

COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health >/dev/null || exit 1
