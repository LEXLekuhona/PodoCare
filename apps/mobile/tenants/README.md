# Tenants (white-label)

Один файл `.env` на заказчика. Активный tenant копируется в `apps/mobile/.env`.

| Файл | Описание |
|------|----------|
| `solodova.env` | Эталон Solodova (локальный API localhost) |
| `solodova-staging.env` | Solodova против staging VPS (`148.253.213.153`) |
| `_template.env` | Пустой шаблон |

## Команды (из корня репозитория)

```bash
pnpm mobile:tenant list              # список пресетов
pnpm mobile:tenant use solodova      # включить Solodova → apps/mobile/.env
pnpm mobile:tenant show solodova     # показать конфиг
pnpm mobile:tenant new my-studio     # мастер создания нового tenant
pnpm mobile:tenant:solodova          # use solodova + подсказка запуска Metro
pnpm dev:mobile:solodova             # use solodova + expo start
pnpm dev:mobile:solodova-staging       # use solodova-staging + expo start (VPS IP)
pnpm solodova:dev                      # infra + migrate + seed + API + mobile
pnpm solodova:dev:admin                # то же + админка вместо mobile
```

После `use` перезапустите Metro (`pnpm dev:mobile`), чтобы подтянуть env.
