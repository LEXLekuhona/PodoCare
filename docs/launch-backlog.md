# Бэклог до коммерческого запуска

Задачи **вне репозитория** или требующие решения бизнеса/юристов/облака. Процедуры на каждый релиз: `docs/release-checklist.md`. Инфраструктура и smoke: `docs/infrastructure-and-operations.md`, `docs/reminders-lifecycle-runbook.md`. Статус фич: `docs/roadmap.md`.

---

## 1. Репозиторий и процесс

- [ ] Свести изменения в `main` через PR (ревью, зелёный CI).
- [ ] На ветке релиз-кандидата **отметить** выполнение `docs/release-checklist.md` после реального прогона (включая smoke на staging, когда среда будет готова).

---

## 2. Staging и production

- [ ] **Staging**, близкий к prod: отдельные Postgres, Redis, S3-совместимое хранилище, секреты вне git — сверка с §1 `docs/infrastructure-and-operations.md`.
- [ ] **Production**: managed Postgres (бэкапы, по возможности PITR), Redis, object storage, секреты только во внешнем хранилище — сверка с §2 там же.
- [ ] **Алерты** по `GET /api/v1/health/queues` на staging и prod (`ALERT_*`, §5 `docs/infrastructure-and-operations.md`).

---

## 3. Продукт и позиционирование

- [ ] **Mobile:** публикация в App Store / Google Play (EAS, политики стора, privacy, согласия).
- [ ] Зафиксировать стратегию: **одна сеть (Solodova)** vs **SaaS для сторонних студий** (onboarding, биллинг платформы, white-label, поддержка).

---

## 4. Платежи на staging / prod

- [ ] Реальные ключи YooKassa / Т‑Банк, публичный HTTPS для webhooks, проверка идемпотентности на **staging**.
- [ ] Терминалы эквайринга в prod: `acquiring_terminals` и/или env, роль `SUPER_ADMIN`, ротация секретов, `DATA_ENCRYPTION_KEY`.
- [ ] Сквозной happy-path «CTA → оплата → статус заказа» на staging (acceptance в `docs/roadmap.md`, блок Monetization).

---

## 5. Юридика и ПДн (РФ)

- [ ] Политика конфиденциальности, согласие на обработку ПДн, обработка медданных (152-ФЗ — с юристом).
- [ ] Договорная модель: B2C, B2B (студия ↔ платформа), оферта/лицензия на ПО при необходимости.
- [ ] При цели B2B/gos: реестр отечественного ПО и требования заказчика — отдельный трек.

---

## 6. Документация и бренд

- [ ] Единое имя продукта в публичных материалах и репозитории (Solodova Recovery System / Podocare) — по бизнес-решению; в релизных профилях убрать «example» там, где нужны реальные контакты.

---

## 7. Критерий «можно продавать как продукт»

Закрыты пункты **1–2**, **3** согласован с бизнесом, юридический минимум из **5** для выбранной модели согласован с юристом, на prod выполнен релиз с заполненным `docs/release-checklist.md` и release notes по `docs/release-notes-template.md`.

---

## Постоянная дисциплина (каждый PR)

См. `docs/sprint-plan-6-weeks.md`: e2e `401`/`403` для новых protected endpoints, только Prisma migrations, синхронное обновление `docs/roadmap.md` при смене scope.

---

## Журнал проверок в репозитории (локально)

| Дата       | Что прогнано                                                                    | Результат               |
| ---------- | ------------------------------------------------------------------------------- | ----------------------- |
| 2026-05-12 | `pnpm --filter @srs/api test:e2e:core -- --ci`                                  | OK (18 тестов)          |
| 2026-05-12 | `pnpm exec jest --config test/jest-e2e.config.js --runInBand --ci` в `apps/api` | OK (68 тестов, все e2e) |
| 2026-05-12 | `pnpm typecheck`, `pnpm lint` (после `eslint --fix` в admin/api)                | OK                      |

Это **не** заменяет smoke на staging и ручной релизный чеклист в §3–7 `docs/release-checklist.md`.
