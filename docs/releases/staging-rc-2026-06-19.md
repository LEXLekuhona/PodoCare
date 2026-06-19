# Release notes — staging RC `2026-06-19`

Окружение: VPS `148.253.213.153` (Docker prod stack: Postgres, Redis, MinIO, API, admin).

## Сводка

Первый формальный релиз-кандидат на staging: автодеплой из `main`, инфраструктурный и минимальный бизнес-smoke, мониторинг очередей.

## Изменения

- CI → SSH автодеплой (`deploy-staging.yml`, `scripts/deploy-staging.sh`).
- `scripts/staging-smoke.sh` — smoke по `docs/infrastructure-and-operations.md` §3.
- Cron на VPS: `health-queues-synthetic-check.sh` каждые 5 мин.
- Ротация слабого `POSTGRES_PASSWORD` на staging.

## Риски

- Публичный доступ к API/admin по IP: без TLS; webhooks платежей (§4 бэклога) потребуют HTTPS.
- Один инстанс API с `RUN_DB_MIGRATIONS=true` — ок для текущего VPS; при горизонтальном масштабе миграции вынести в pre-deploy.

## Мониторинг в первые часы после деплоя

- [x] `GET /api/v1/health` и `GET /api/v1/health/queues`
- [x] Cron synthetic check на VPS
- [x] Public smoke в GitHub Actions после деплоя

## Миграции и откат

- Prisma: применяются при старте API (`prisma migrate deploy`).
- Откат приложения: предыдущий git commit + `./scripts/deploy-staging.sh` или `workflow_dispatch` после revert.
- Откат БД: из volume backup / ручной restore (PITR на managed Postgres — для будущего prod).

## Release checklist (staging RC)

| Раздел | Статус |
|--------|--------|
| 1 Core e2e | CI на `main` (merge-gate) |
| 2 Миграции | `RUN_DB_MIGRATIONS` на staging |
| 4 Очереди | `health/queues` ok, cron настроен |
| 5 Мониторинг | `ALERT_*` в `.env`, runbook актуален |
| 7 Staging smoke | `scripts/staging-smoke.sh` — 2026-06-19 |

Ручные пункты (appointments create/cancel, оплата) — при следующем RC или в §4 бэклога.

## Ссылки

- Smoke: `scripts/staging-smoke.sh`
- Бэклог: `docs/launch-backlog.md`
