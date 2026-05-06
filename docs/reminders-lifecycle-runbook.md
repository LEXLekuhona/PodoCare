# Runbook: reminders/lifecycle incidents

Минимальный операционный runbook для инцидентов в очередях напоминаний (`notifications`) и lifecycle (`appointments`).

## 1. Что мониторим (alerts)

- Endpoint: `GET /api/v1/health/queues`.
- Поля:
  - `notifications.reminderDelayedJobs`
  - `appointments.lifecycleDelayedJobs`
  - `alerts.thresholds.*`
  - `alerts.breaches`
  - `alerts.reaction`
- Триггеры:
  - `status=warn` — деградация (рост delayed jobs).
  - `status=critical` — инцидент, реакция немедленно.

Рекомендуемые дефолтные пороги (см. `.env.example`):

- `ALERT_REMINDER_DELAYED_WARN=100`
- `ALERT_REMINDER_DELAYED_CRITICAL=300`
- `ALERT_LIFECYCLE_DELAYED_WARN=50`
- `ALERT_LIFECYCLE_DELAYED_CRITICAL=150`

## 2. Первичная диагностика (первые 10 минут)

1. Проверить `GET /api/v1/health`:
   - `redis`, `notificationsQueue`, `appointmentsQueue` должны быть `up`.
2. Снять срез `GET /api/v1/health/queues`:
   - оценить, какая очередь ушла в `warn/critical`.
3. Проверить логи API/воркеров по `requestId`, `appointmentId`, `jobId`:
   - ошибки enqueue/revoke;
   - массовые retry/fail.
4. Запустить smoke-сценарий:
   - `create appointment` -> reminder/lifecycle jobs появились;
   - `reschedule` -> jobs пересозданы;
   - `cancel` -> jobs удалены.

## 3. Реакция и смягчение

- Если очередь не обрабатывается:
  - перезапустить воркеры очередей;
  - убедиться, что Redis доступен и без saturation;
  - повторить smoke.
- Если зависли delayed jobs:
  - проверить, нет ли массовых invalid policy/template;
  - временно снизить входной поток операций записи (операционный throttling);
  - при необходимости вручную перепланировать affected записи через API (reschedule/cancel+create).
- Если только один tenant/network деградирует:
  - локализовать по `networkId`, ограничить blast radius, коммуницировать студии.

## 4. Критерий восстановления

- `GET /api/v1/health/queues` -> `status=ok`.
- Нет роста `failed` jobs в `GET /api/v1/health`.
- Smoke create/reschedule/cancel проходит без хвостов в delayed.

## 5. Rollback (минимальный план)

1. Откатить последний backend deploy на предыдущий стабильный image/tag.
2. Если инцидент вызван конфигом порогов/политик:
   - вернуть рабочие значения env (`ALERT_*`) и/или reminder policies.
3. После rollback:
   - перезапустить воркеры;
   - повторить smoke;
   - зафиксировать post-incident notes (таймлайн, root cause, action items).
