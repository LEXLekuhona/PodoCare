# Solodova Recovery System

Экосистема для подологических студий: **контент-first продукт**, в центре которого — воронка прогрева от бесплатного контента и диагностического квиза до длительных программ сопровождения.

## Продуктовые приоритеты

Solodova Recovery System — **единственный источник правды** для всех записей и коммуникаций с клиентом (iKlients не используется). Это значит: записи создаются/отменяются/напоминаются исключительно через нашу систему, SMS и push-уведомления мы отправляем сами.

Стратегически продукт — **не инструмент записи, а контент-воронка**: контент + личный бренд основателя переводит клиента от разовой консультации к длинной программе. Но операционка студии (расписание, напоминания, оплаты) без нас теперь не работает, поэтому её качество критично с первого дня.

### Порядок модулей по ценности

| Приоритет | Модуль | Роль в системе |
|---|---|---|
| **1** | `auth` | Фундамент: OTP для клиентов, email+password для персонала, PIN для роли `SPECIALIST` (вход в admin из кабинета) |
| **1** | `appointments` + `shifts` + `slots` | Операционное ядро студии (раньше это был iKlients) |
| **1** | `notifications` (SMS + Push + Email + Templates + ReminderPolicy + Scheduler) | Без напоминаний записи не работают — критический модуль |
| **1** | `content` (ContentSeries + ContentItem + ContentCta) | Ядро воронки: личный контент автора, серии, прогрев через CTA |
| **1** | `diagnostic-quiz` | Точка входа «из сарафана» + сегментация клиентов |
| **2** | `treatment-plan` + `appointment-protocol` | Документация мастера, точка возврата клиента в приложение |
| **3** | `programs` + `program-inquiry` + `installment-request` | Длинные программы (250k+), заявка → менеджер → договор |
| **3** | `payments` (ЮКасса: СБП + карты) | Онлайн-оплата консультаций, контента, физтоваров |
| **4** | `orders` + `physical-goods` + `shipment` | Магазин средств ухода и натуропатических продуктов |
| **4** | `funnel-events` | Аналитика пути клиента по воронке |

### Роли

- `CLIENT` — мобильное приложение.
- `SPECIALIST` — тот же `apps/admin` в браузере в кабинете (планшет или ПК): урезанная навигация, права на API, запреты покрыты e2e на `403`.
- `STUDIO_ADMIN` / `NETWORK_OWNER` — операционная админка.
- **`CONTENT_AUTHOR`** — отдельная роль для основателя бренда: редактирует контент, квизы, программы независимо от операционки.
- `SUPER_ADMIN` — техподдержка платформы.

### Уведомления — как устроено

Свой модуль, закрывающий все коммуникации с клиентом без внешних CRM:

- **Каналы**: SMS (российские провайдеры через абстракцию `SmsProvider`: `SMS.RU`, `SMSC`, `UniSender`, `SMS Aero`), Push (Expo / FCM / APNs), Email (Resend / SMTP), In-app.
- **Шаблоны** хранятся в БД (`NotificationTemplate`): ключ + канал + язык → текст с mustache-плейсхолдерами. Редактируется в админке без деплоя.
- **Политики напоминаний** (`ReminderPolicy`): «за 24 ч — SMS», «за 1 ч — push», «за 15 мин — push» и т.п., настраивается в админке сети.
- **Планировщик** — BullMQ delayed jobs (очередь `reminders`, `sms`, `push`, `email`). При создании/переносе/отмене записи планируем или отменяем задания.
- **Журнал** (`Notification`): снапшот получателя, шаблона, провайдера, `providerMessageId`, `costMinor`, статусы `QUEUED → SENDING → SENT → DELIVERED / FAILED / SUPPRESSED`.
- **Подписки** (`NotificationPreference`): клиент может отключить маркетинг и новый контент. Технические уведомления (запись/чек/заказ) шлём всегда.
- **Мульти-устройства** (`PushDevice`): у пользователя может быть телефон + планшет + старое устройство, рассылаем на все активные.

## Структура монорепо

```
solodova-recovery-system/
├── apps/
│   ├── api/          — NestJS backend (Postgres + Redis + BullMQ + S3)
│   ├── mobile/       — Expo (клиент)
│   └── admin/        — React + Refine (операционка сети + роль SPECIALIST в студии)
├── packages/
│   ├── tsconfig/         — общие tsconfig
│   ├── eslint-config/    — общий ESLint flat-config
│   └── shared-types/     — общие типы и enum'ы для API и клиентов
├── docker-compose.yml    — Postgres 16 + Redis 7 + MinIO + Adminer
├── turbo.json
└── pnpm-workspace.yaml
```

## Требования

- **Node.js** ≥ 22 (рекомендуется 22.12.x, см. `.nvmrc`)
- **pnpm** ≥ 10 (устанавливается через [get.pnpm.io](https://pnpm.io/installation))
- **Docker Desktop** (для локальной инфраструктуры)

## Быстрый старт

```bash
# 1. Скопировать переменные окружения
cp .env.example .env

# 2. Установить зависимости
pnpm install

# 3. Поднять инфраструктуру (Postgres + Redis + MinIO + Adminer)
pnpm docker:up

# 4. Сгенерировать Prisma Client и применить миграции
pnpm --filter @srs/api exec prisma generate
pnpm --filter @srs/api exec prisma migrate dev --name init

# 5. Залить начальные данные
pnpm --filter @srs/api prisma:seed

# 6. Запустить API в dev-режиме
pnpm --filter @srs/api dev
```

После запуска:

- API: <http://localhost:3000/api/v1>
- Swagger: <http://localhost:3000/docs>
- Adminer: <http://localhost:8085> (host: `postgres`, user/pass из `.env`)
- MinIO Console: <http://localhost:9001>

## Команды

### Корень монорепо

| Команда                | Что делает                                      |
| ---------------------- | ----------------------------------------------- |
| `pnpm dev`             | `turbo run dev` — поднимает все dev-серверы     |
| `pnpm build`           | собирает все пакеты                             |
| `pnpm lint`            | линтинг всех пакетов                            |
| `pnpm typecheck`       | проверка типов                                  |
| `pnpm test`            | все тесты                                       |
| `pnpm test:unit`       | только unit-тесты                               |
| `pnpm test:integration`| только интеграционные (с testcontainers)        |
| `pnpm test:e2e`        | только e2e                                      |
| `pnpm test:e2e:core`   | core e2e merge-gate (`auth` + `notifications` + `appointments`) |
| `pnpm format`          | Prettier                                        |
| `pnpm docker:up`       | поднимает Postgres + Redis + MinIO + Adminer    |
| `pnpm docker:down`     | останавливает                                   |
| `pnpm docker:reset`    | сбрасывает volumes и запускает заново           |
| `pnpm docker:up:prod`  | инфраструктура + API + админка (Docker)         |
| `pnpm docker:build:prod` | пересборка образов API и admin                |

### Docker: API + админка на сервере

Образы: `apps/api/Dockerfile`, `apps/admin/Dockerfile` (nginx со статикой Vite). Compose-оверлей: `docker-compose.prod.yml` (использует Postgres/Redis/MinIO из корневого `docker-compose.yml`).

```bash
cp .env.example .env
# JWT_*, DATA_ENCRYPTION_KEY — обязательно сменить для prod
# Для локального Docker-стека достаточно значений по умолчанию из .env.example

pnpm docker:up:prod
# Админка: http://localhost:8080
# API:     http://localhost:3000/api/v1

# Первый супер-админ (только dev/staging):
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api pnpm create-dev-admin:docker
```

На **реальном домене** перед сборкой задайте URL API для браузера (вшивается в статику админки):

```bash
export VITE_API_URL=https://api.example.com/api/v1
export API_CORS_ORIGINS=https://admin.example.com
pnpm docker:build:prod && pnpm docker:up:prod
```

Подробнее по переменным: `apps/admin/.env.docker.example`. API при старте выполняет `prisma migrate deploy` (`RUN_DB_MIGRATIONS=true`, можно отключить для отдельного job миграций).

### API (`apps/api`)

| Команда                                       | Что делает                              |
| --------------------------------------------- | --------------------------------------- |
| `pnpm --filter @srs/api dev`             | nest start --watch                      |
| `pnpm --filter @srs/api test:unit:cov`   | unit-тесты с покрытием                  |
| `pnpm --filter @srs/api prisma:studio`   | визуальный редактор БД                  |
| `pnpm --filter @srs/api prisma:reset`    | сброс БД и повторный seed               |

## Архитектура бэкенда

```
apps/api/src/
├── config/                 — zod-валидация env, registerAs конфиги
├── common/                 — shared guards, filters, interceptors, decorators
├── infrastructure/         — cross-cutting: prisma, redis, crypto, queue, storage
└── modules/                — bounded contexts
    └── <module>/
        ├── domain/         — entities, value objects, port-интерфейсы
        ├── application/    — use-cases, сервисы (чистая бизнес-логика)
        ├── infrastructure/ — Prisma-репозитории, внешние адаптеры
        └── presentation/   — HTTP controllers, DTO
```

### Стратегия тестов

| Уровень     | Где          | Что проверяет                                    |
| ----------- | ------------ | ------------------------------------------------ |
| Unit        | `src/**/*.spec.ts` | Чистая логика с моками                     |
| Integration | `test/integration/*.integration-spec.ts` | Репозитории + БД (testcontainers) |
| E2E         | `test/e2e/*.e2e-spec.ts` | Полный HTTP-цикл (supertest)          |

Порог покрытия для бизнес-логики — **70%** (настраивается в `jest-unit.config.ts`).

## Текущий статус backend

Уже реализовано и покрыто e2e:

- **Auth**: `POST /api/v1/auth/otp/request`, `otp/verify`, `staff/login`, `refresh`, `logout`; сессии в `AuthSession`, ротация refresh-token.
- **Notifications core**:
  - шаблоны и политики (`/notifications/templates`, `/notifications/reminder-policies`);
  - отправка SMS через очередь (`/notifications/send-sms`);
  - настройки пользователя (`/notifications/preferences`);
  - регистрация девайсов (`/notifications/push-devices`);
  - suppression (`NotificationStatus=SUPPRESSED`) по `NotificationPreference`;
  - единый security-контракт: защищённые endpoints + e2e на `401/403`.
- **Appointments MVP**:
  - создание/список/подтверждение/отмена (`cancel-by-client`, `cancel-by-studio`);
  - перенос (`reschedule`) с проверкой смены и пересечений;
  - автопланирование напоминаний по `ReminderPolicy` при создании записи;
  - отмена/пересоздание reminder jobs при отмене и переносе записи;
  - роли на protected endpoints + e2e проверка `401/403`.
- **Health/observability**:
  - smoke-снимок очередей и lifecycle jobs: `GET /api/v1/health/queues`;
  - alert thresholds для delayed jobs (`warn/critical`) в ответе `health/queues`, конфиг через `ALERT_*` env;
  - queue health (`notifications`, `appointments`) включён в `GET /api/v1/health`.
  - runbook инцидентов reminders/lifecycle: `docs/reminders-lifecycle-runbook.md`.

## Что дальше

Порядок реализации отражает продуктовые приоритеты из раздела выше.

## Release checklist

- Обязательный релизный чеклист: `docs/release-checklist.md`.
- PR template с обязательными пунктами (core e2e, миграции, DTO backward compatibility, очереди/мониторинг): `.github/pull_request_template.md`.
- CI gate на pull request проверяет наличие обязательных разделов и выбранного Sprint/Priority: `.github/workflows/pr-checklist.yml`.

### Roadmap и sprint-статус

Единый источник правды по фактическому статусу спринтов, переносу scope и baseline KPI стабильности:

- `docs/roadmap.md`

README фиксирует только архитектуру и принципы релизного процесса, а оперативный статус Sprint 1+ поддерживается в roadmap-документе, синхронно с кодом.

## Лицензия

Proprietary — © Solodova Recovery System, 2026.
