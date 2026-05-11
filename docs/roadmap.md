# Roadmap Status (Single Source of Truth)

Единая точка фиксации статуса спринтов и монетизации. Обновлять вместе с кодом и релизным чеклистом.

**До коммерческого запуска (окружения, сторы, юридика):** `docs/launch-backlog.md`  
**Релизный gate на каждый выкат:** `docs/release-checklist.md`  
**Инфраструктура и эксплуатация:** `docs/infrastructure-and-operations.md`, `docs/release-notes-template.md`  
**Закрытый 6-недельный план и постоянные правила:** `docs/sprint-plan-6-weeks.md`

---

## Сводка по спринтам 1–3 (shipped)

- **Sprint 1:** core e2e merge-gate (`auth`, `notifications`, `appointments`), `GET /api/v1/health/queues`, интеграция очередей в `GET /api/v1/health`, релизный чеклист, PR template и PR checklist gate в CI.
- **Sprint 2:** контентная воронка end-to-end (в т.ч. paywall/preview, CTA на mobile, админ-редактор), диагностический квиз (builder, scoring, anonymous + merge), in-app медиа для обучения — см. [ADR 0002](adr/0002-mobile-education-in-app-playback.md); валидация `body` контента на write; e2e по новым guarded-маршрутам по мере добавления.
- **Sprint 3:** план лечения / протокол визита сквозняком, уведомления о плане; monetization MVP в API (program-inquiry, installment, YooKassa, orders, shipment, visit-invoice, Tinkoff/терминалы, idempotent webhooks) — детали в блоке Monetization ниже.

---

## Monetization (ветка после core)

### Цель

Монетизация программ и товаров: заявка, рассрочка, оплата, заказ, доставка.

### Порядок реализации (логический)

1. `program-inquiry`
2. `installment-request`
3. `payments` (ЮKassa)
4. `orders` + `shipment`

### Факт в коде (backend MVP, май 2026)

- API: `program-inquiries`, `installment-requests`, `orders/checkout`, `orders/:id/payments`, `webhooks/yookassa`, `payments/:id/refund`, `orders/:id/shipment`.
- Счёт после приёма: `POST /orders/visit-invoice`, оплата `visit-payments/cash`, `visit-payments/tinkoff-init`, `POST /webhooks/tinkoff`; онлайн-оплата клиентом по такому заказу заблокирована. Позиции `SERVICE` + `PHYSICAL_GOOD`, списание остатка студии при успешной оплате.
- Терминалы: `acquiring_terminals`, `GET/POST/PATCH/DELETE /admin/acquiring-terminals` (`SUPER_ADMIN`), шифрование `DATA_ENCRYPTION_KEY`; приоритет терминала студии → платформенный → env `TINKOFF_*`.
- Идемпотентность webhook: `processed_provider_webhooks`. Без `YOOKASSA_*` в dev — провайдер `MANUAL`.
- E2E: `test/e2e/monetization.e2e-spec.ts`, `treatment-plans.e2e-spec.ts` (в т.ч. уведомление о плане).

### Out of Scope (пока)

- Полноценный ERP/складской контур.
- Полный мульти-эквайринг с динамическим роутингом сумм (частично закрыто терминалами в БД; развитие — по продукту).

### Acceptance Criteria (ещё проверять на staging/prod)

- Сквозной happy-path от CTA до оплаченного заказа.
- Webhook/payment idempotency без двойного списания.
- Финансовые статусы консистентны.

Открытые **нефункциональные** шаги до продажи (ключи, сторы, алерты): `docs/launch-backlog.md`.

---

## Общие нефункциональные требования

- Новые protected endpoints — e2e `401`/`403`.
- `lint` / `typecheck` / `test` без новых flaky core e2e.
- Логи: `requestId`, ключевые `entityId`, критичные статусы.
- Миграции: Prisma + учёт отката (см. guardrails репозитория).
- Контракты: обратная совместимость mobile/admin.

---

## KPI стабильности (baseline)

- Core e2e pass rate (merge-gate): **100%** обязательных прогонов в CI.
- Core e2e flaky rate: **0%** (без ручных retry ради gate).
- Инциденты очередей reminders/lifecycle: **0** критических на закрытии спринта.

## Правило «2–3 спринта без регрессий»

- Не опускать pass rate core e2e ниже baseline.
- Не допускать рост flaky rate выше baseline.
- Не допускать queue incidents уровня блокера релиза.
- Любое отклонение — в release notes и возврат задачи в P0/core stability.
