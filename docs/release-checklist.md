# Release Checklist

Этот чеклист обязателен для каждого релиза (включая hotfix), чтобы исключить регрессии по ядру и инфраструктуре. Задачи до первого коммерческого выката (облако, сторы, юристы): `docs/launch-backlog.md` (юридический трек — раздел 5).

## 1) Core Stability Gate (обязательно перед merge)

- [ ] `auth + notifications + appointments` e2e проходят локально и в CI (`pnpm --filter @srs/api test:e2e:core -- --ci`).
- [ ] Для новых/изменённых protected endpoint'ов добавлены тесты `401` и `403` (если endpoint role-restricted).
- [ ] Нет новых флейков в core e2e (не принимаем "зелёный только после ручного ретрая").

## 2) Миграции и схема

- [ ] Все новые prisma-миграции приложены и применимы на чистой базе.
- [ ] Проверена обратная совместимость rollout-порядка (сначала DB migration, потом deploy приложения).
- [ ] Нет breaking-изменений enum/DTO без явного migration-note.

## 3) DTO/API Backward Compatibility

- [ ] Изменения публичных DTO совместимы с текущими клиентами (mobile/admin).
- [ ] Для несовместимых изменений есть feature-flag или staged rollout.
- [ ] Swagger/контракты синхронизированы с фактической реализацией.

## 4) Очереди и фоновые job'ы

- [ ] Проверен smoke endpoint `GET /api/v1/health/queues`.
- [ ] Проверено, что reminders/lifecycle jobs создаются и отрабатывают в expected state.
- [ ] Проверены негативные сценарии: revoke/reschedule/cancel не оставляют "висячие" jobs.

## 5) Мониторинг и операционка

- [ ] Алерты по `GET /api/v1/health/queues` настроены на пороги `warn/critical` (см. `ALERT_*` env).
- [ ] Runbook для reminders/lifecycle актуален: `docs/reminders-lifecycle-runbook.md`.
- [ ] Логи содержат достаточно контекста (request id, entity id, job id) для диагностики.

## 6) Документация и roadmap

- [ ] README отражает фактический shipped scope релиза.
- [ ] Roadmap/status обновлены синхронно с кодом (`docs/roadmap.md` — single source of truth).
- [ ] Baseline KPI стабильности обновлены на конец спринта (core e2e pass rate, flaky rate, queue incidents).
- [ ] Если изменился релизный процесс, обновлён этот чеклист и PR template.

## 7) Финальная проверка перед релизом

- [ ] Выполнен минимальный smoke в staging (шаги: раздел 3 в `docs/infrastructure-and-operations.md`).
- [ ] Подготовлен rollback-план (приложение + миграции: раздел 4 в `docs/infrastructure-and-operations.md`).
- [ ] Зафиксированы release notes по шаблону `docs/release-notes-template.md` (изменения, риски, мониторинг первых часов).
