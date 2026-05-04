# PodoCare

Экосистема для подологических студий: **контент-first продукт**, в центре которого — воронка прогрева от бесплатного контента и диагностического квиза до длительных программ сопровождения.

## Продуктовые приоритеты

PodoCare — **единственный источник правды** для всех записей и коммуникаций с клиентом (iKlients не используется). Это значит: записи создаются/отменяются/напоминаются исключительно через нашу систему, SMS и push-уведомления мы отправляем сами.

Стратегически продукт — **не инструмент записи, а контент-воронка**: контент + личный бренд основателя переводит клиента от разовой консультации к длинной программе. Но операционка студии (расписание, напоминания, оплаты) без нас теперь не работает, поэтому её качество критично с первого дня.

### Порядок модулей по ценности

| Приоритет | Модуль | Роль в системе |
|---|---|---|
| **1** | `auth` | Фундамент: OTP для клиентов, email+password для персонала, PIN для планшета |
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
- `SPECIALIST` — планшет в студии.
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
podocare/
├── apps/
│   ├── api/          — NestJS backend (Postgres + Redis + BullMQ + S3)
│   ├── mobile/       — Expo (клиент)
│   ├── tablet/       — Expo (студия)  — добавится на следующем этапе
│   └── admin/        — React + Refine  — добавится на следующем этапе
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
pnpm --filter @podocare/api exec prisma generate
pnpm --filter @podocare/api exec prisma migrate dev --name init

# 5. Залить начальные данные
pnpm --filter @podocare/api prisma:seed

# 6. Запустить API в dev-режиме
pnpm --filter @podocare/api dev
```

После запуска:

- API: <http://localhost:3000/api/v1>
- Swagger: <http://localhost:3000/docs>
- Adminer: <http://localhost:8080> (host: `postgres`, user/pass из `.env`)
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
| `pnpm format`          | Prettier                                        |
| `pnpm docker:up`       | поднимает Postgres + Redis + MinIO + Adminer    |
| `pnpm docker:down`     | останавливает                                   |
| `pnpm docker:reset`    | сбрасывает volumes и запускает заново           |

### API (`apps/api`)

| Команда                                       | Что делает                              |
| --------------------------------------------- | --------------------------------------- |
| `pnpm --filter @podocare/api dev`             | nest start --watch                      |
| `pnpm --filter @podocare/api test:unit:cov`   | unit-тесты с покрытием                  |
| `pnpm --filter @podocare/api prisma:studio`   | визуальный редактор БД                  |
| `pnpm --filter @podocare/api prisma:reset`    | сброс БД и повторный seed               |

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
  - suppression (`NotificationStatus=SUPPRESSED`) по `NotificationPreference`.
- **Appointments MVP**:
  - создание/список/подтверждение/отмена (`cancel-by-client`, `cancel-by-studio`);
  - перенос (`reschedule`) с проверкой смены и пересечений;
  - автопланирование напоминаний по `ReminderPolicy` при создании записи;
  - отмена/пересоздание reminder jobs при отмене и переносе записи.

## Что дальше

Порядок реализации отражает продуктовые приоритеты из раздела выше.

### Ближайшие спринты

1. **Auth** — минимальная основа для всех остальных модулей:
   - OTP-вход по телефону для клиентов (сам OTP шлём через модуль `notifications`, шаблон `AUTH_OTP`).
   - Email + password для персонала, PIN (Argon2id) для планшета.
   - JWT access (15 мин) + refresh (30 дней) с хранением hash в `AuthSession`.
   - Guards по ролям, `@CurrentUser`, `@RequirePermissions`.
2. **Notifications core** (необходимо сразу после auth, блокирует всё остальное):
   - Абстракция `SmsProvider` + реализация одного провайдера для MVP (`SMS.RU` как самый простой), `ConsoleSmsProvider` для dev.
   - Абстракция `PushProvider` + Expo Push в проде, `ConsolePushProvider` в dev.
   - Движок рендеринга шаблонов (mustache) из `NotificationTemplate` + фолбек на дефолтные системные шаблоны в коде.
   - BullMQ-очередь `notifications` с воркером, который пишет в таблицу `Notification` при отправке.
   - Управление `PushDevice` (регистрация/деактивация токена при логине/логауте).
   - `NotificationPreference` и уважение quiet hours.
3. **Appointments + shifts + slots** (вместе с уведомлениями):
   - Advisory lock на слот, проверки пересечений и активной смены.
   - Lifecycle: `PENDING → CONFIRMED → IN_PROGRESS → COMPLETED` / `CANCELLED_BY_CLIENT` / `NO_SHOW`.
   - Планировщик: при создании/подтверждении записи — скедулим delayed jobs по активным `ReminderPolicy`; при отмене/переносе — отменяем/перескедуливаем.
   - BullMQ авто-статусы (no-show после окончания слота без старта, авто-`IN_PROGRESS` по времени).
4. **Content** (контент-ядро):
   - CRUD серий, единиц контента и CTA (только `CONTENT_AUTHOR`).
   - Публичная лента для клиентов с учётом `audience` и платного доступа.
   - Прогресс прохождения, запись событий `FunnelEvent`.
   - Загрузка видео/картинок в MinIO/S3 через presigned URL.
   - Push-уведомления подписчикам при публикации (шаблон `NEW_CONTENT_PUBLISHED`).
5. **Diagnostic quiz**:
   - Построитель квиза в админке автора.
   - Движок скоринга: скаляр + теги → выбор `DiagnosticOutcome`.
   - Прохождение анонимно (по `anonymousSessionId`) + мердж в профиль после регистрации.
   - После завершения — push/SMS с результатом (`QUIZ_RESULT_READY`).
6. **Treatment plan + appointment protocol**:
   - Заполняет мастер на планшете, видимость контролируется `clientVisible`.
   - Push клиенту после создания плана (шаблон `TREATMENT_PLAN_READY`).
7. **Programs + inquiries + installment**:
   - Витрина программ от автора.
   - Форма заявки → очередь менеджера → лог действий в `activityLog`.
   - Интеграция с Т-Рассрочкой / Halva для ссылок на заявку.
8. **Payments (ЮКасса)**:
   - Абстракция `PaymentProvider` (SBP + карты).
   - Вебхуки, идемпотентность, возвраты.
9. **Orders + physical goods + shipment**:
   - Корзина, чекаут, СДЭК (ПВЗ + курьер), самовывоз.
   - Push-статусы заказа (шаблон `ORDER_STATUS_UPDATE`).
10. **Клиентские приложения**:
    - `apps/mobile` (Expo + FSD) — контент-first лента, квиз, кабинет, запись, магазин, оплата.
    - `apps/tablet` (Expo + FSD) — расписание мастера, протокол визита, медкарта, план лечения.
    - `apps/admin` (React + FSD) — редактор контента (для автора), операционка (для `STUDIO_ADMIN`/`NETWORK_OWNER`), редактор шаблонов и политик напоминаний.

## Лицензия

Proprietary — © PodoCare, 2026.
