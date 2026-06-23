# Tenants (white-label)

Один файл `.env` на заказчика. Активный tenant копируется в `apps/mobile/.env`.

| Файл | Описание |
|------|----------|
| `solodova.env` | Эталон Solodova (dev и образец для новых) |
| `_template.env` | Пустой шаблон |

## Команды (из корня репозитория)

```bash
pnpm mobile:tenant list              # список пресетов
pnpm mobile:tenant use solodova      # включить Solodova → apps/mobile/.env
pnpm mobile:tenant show solodova     # показать конфиг
pnpm mobile:tenant new my-studio     # мастер создания нового tenant
pnpm mobile:tenant:solodova          # use solodova + подсказка запуска Metro
pnpm dev:mobile:solodova             # use solodova + expo start
```

После `use` перезапустите Metro (`pnpm dev:mobile`), чтобы подтянуть env.
