# План на 6 недель (Sprint 1–3)

Исторический спринт-план (недели 1–6) **закрыт**: deliverables по stability gate, content funnel, quiz, treatment plan и monetization MVP отражены в `docs/roadmap.md` и в коде.

## Что остаётся как постоянная дисциплина

Выполняется на **каждом** PR/релизе, не «один раз за спринт»:

1. [ ] Новые protected endpoints — всегда e2e на `401` и `403` (правило репозитория).
2. [ ] Схема БД — только через Prisma migrations, с учётом rollout-порядка (additive → код → cleanup/backfill).
3. [ ] При изменении scope или критериев готовности — обновлять `docs/roadmap.md` синхронно с кодом.

## Куда смотреть дальше

- Коммерческий запуск и окружения: `docs/launch-backlog.md`
- Релиз каждого выката: `docs/release-checklist.md`
- Операционка: `docs/infrastructure-and-operations.md`, `docs/reminders-lifecycle-runbook.md`
