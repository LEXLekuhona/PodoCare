# Roadmap Status (Single Source of Truth)

Этот документ — единственная точка фиксации фактического статуса спринтов.
Обновляется вместе с кодом и релизным чеклистом.

## Sprint 1 — факт выполнения

### Закрыто (shipped)

- Core stability gate в CI: отдельный job `core-e2e-gate` с `pnpm --filter @srs/api test:e2e:core -- --ci` (`auth + notifications + appointments`) в `.github/workflows/ci.yml`.
- Backend core покрыт e2e и используется как merge-gate:
  - Auth: OTP/staff login/refresh/logout + `401/403` контракты.
  - Notifications: шаблоны, reminder policies, SMS queue/worker, preferences, push devices.
  - Appointments: create/reschedule/cancel, lifecycle jobs, перепланирование reminder jobs.
- Очереди и наблюдаемость:
  - `GET /api/v1/health/queues` реализован и покрыт e2e smoke-тестом.
  - Queue health по `notifications` и `appointments` включён в `GET /api/v1/health`.
- Release governance:
  - релизный чеклист: `docs/release-checklist.md`;
  - PR template: `.github/pull_request_template.md`;
  - PR checklist gate: `.github/workflows/pr-checklist.yml`.

### Перенесено в Sprint 2

- **Обучение (mobile):** просмотр видео **в приложении** (нативный плеер), план фаз — [ADR 0002: mobile education in-app playback](adr/0002-mobile-education-in-app-playback.md). Внешние URL — вспомогательный сценарий (CTA), не замена in-app для урока.
- Content funnel end-to-end: CRUD серий/контента/CTA, audience/paywall, progress и `FunnelEvent`, публикация с push.
- Diagnostic quiz вертикаль: редактор квиза, scoring engine, anonymous flow и merge после регистрации.
- Treatment plan / appointment protocol как полноценный пользовательский флоу (tablet + client visibility).

## Sprint 2 — core gate перед monetization

### Обязательный core scope (до запуска monetization-ветки)

- Content funnel.
- Diagnostic quiz.
- Treatment plan / appointment protocol.

### Definition of Done для Sprint 2 core

- На каждый core-поток есть минимум 1 сквозной e2e happy-path.
- Для новых protected endpoints есть security e2e (`401/403`).
- Merge в `main` проходит только при зелёных core e2e + PR checklist gate.
- KPI стабильности не хуже baseline Sprint 1.

## Monetization-ветка (после core Sprint 2)

### Цель

Монетизация длинных программ и товаров: заявка, рассрочка, оплата, заказ, доставка.

### Порядок реализации

1. `program-inquiry`
2. `installment-request`
3. `payments` (ЮKassa: СБП/карты)
4. `orders` + `shipment`

### In Scope (минимум)

- Лид на программу с воронки.
- Заявка на рассрочку.
- Создание платежа, webhook-статусы, идемпотентность.
- Создание заказа и статусов доставки.

### Out of Scope

- Полноценный ERP/складской контур.
- Мульти-эквайринг в Sprint 2.

### Acceptance Criteria

- От CTA до оплаченного заказа есть сквозной happy-path.
- Закрыты webhook/payment idempotency кейсы.
- Финансовые статусы консистентны (`no double charge`).

### Общие нефункциональные требования

- Безопасность: новые protected endpoints покрыты `401/403` e2e.
- Качество: `lint`/`typecheck`/`test` зелёные, без новых flaky core e2e.
- Наблюдаемость: логи с `requestId`, ключевыми `entityId`, критичными статусами.
- Миграции: Prisma migration + rollback considerations.
- Контракты: backward compatibility для mobile/admin.
- Документация: `README`, `docs/roadmap.md`, release notes обновлены.

## KPI стабильности (baseline на конец Sprint 1)

- Core e2e pass rate (merge-gate): **100%** обязательных прогонов в CI.
- Core e2e flaky rate: **0%** (без ручных retry для прохождения gate).
- Инциденты очередей reminders/lifecycle: **0** критических инцидентов на закрытии спринта.

## Правило "2–3 спринта без регрессий"

- Не опускаем pass rate core e2e ниже baseline merge-gate.
- Не допускаем рост flaky rate выше baseline.
- Не допускаем queue incidents уровня "блокер релиза".
- Любое отклонение фиксируется в release notes и возвращает задачу в P0/core stability.
