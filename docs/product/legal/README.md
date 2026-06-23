# Юридические шаблоны Podocare (черновики)

**Важно:** документы подготовлены как **рабочие шаблоны** для B2B SaaS (подологические студии, РФ). Это **не** замена консультации адвоката. Перед первым договором с заказчиком рекомендуется проверка у юриста с учётом ваших реквизитов и специфики студии.

## Состав пакета

| Документ | Назначение | Стороны |
|----------|------------|---------|
| [b2b-license-agreement.md](b2b-license-agreement.md) | Лицензия на ПО + услуги SaaS | Podocare ↔ студия |
| [dpa.md](dpa.md) | Обработка ПДн (152-ФЗ) | Оператор: студия; Обработчик: Podocare |
| [b2c-privacy-policy-template.md](b2c-privacy-policy-template.md) | Политика конфиденциальности для клиентов студии | Публикует **студия** на своём URL |
| [b2c-user-agreement-template.md](b2c-user-agreement-template.md) | Пользовательское соглашение приложения | Студия ↔ клиент |
| [b2c-consent-personal-data-template.md](b2c-consent-personal-data-template.md) | Согласие на обработку ПДн | В приложении |
| [b2c-consent-medical-template.md](b2c-consent-medical-template.md) | Информированное согласие / мед. информация | В приложении |

Коммерческие условия: [../b2b-tariff.md](../b2b-tariff.md) v0.3 (приложение к B2B-договору).  
Онбординг: [../customer-release-checklist.md](../customer-release-checklist.md).

## Плейсхолдеры (заменить перед подписанием)

### Podocare (лицензиар)

| Плейсхолдер | Пример |
|-------------|--------|
| `{{PODOCARE_LEGAL_NAME}}` | ООО «Подокеа» |
| `{{PODOCARE_INN}}` | 7700000000 |
| `{{PODOCARE_OGRN}}` | 1234567890123 |
| `{{PODOCARE_ADDRESS}}` | г. Москва, … |
| `{{PODOCARE_EMAIL}}` | legal@podocare.ru |
| `{{PODOCARE_PRIVACY_EMAIL}}` | privacy@podocare.ru |
| `{{PODOCARE_SIGNATORY}}` | Иванов И.И., генеральный директор |

### Заказчик (студия) — в каждом договоре отдельно

| Плейсхолдер | |
|-------------|--|
| `{{CUSTOMER_LEGAL_NAME}}` | |
| `{{CUSTOMER_INN}}` | |
| `{{CUSTOMER_ADDRESS}}` | |
| `{{CUSTOMER_EMAIL}}` | |
| `{{CUSTOMER_SIGNATORY}}` | |

### B2C (студия для своих клиентов)

| Плейсхолдер | |
|-------------|--|
| `{{STUDIO_BRAND_NAME}}` | Бренд в приложении |
| `{{STUDIO_LEGAL_NAME}}` | Юрлицо оператора ПДн |
| `{{STUDIO_PRIVACY_URL}}` | https://studio.ru/privacy |
| `{{STUDIO_SUPPORT_EMAIL}}` | support@studio.ru |
| `{{STUDIO_ADDRESS}}` | |

## Порядок использования

1. Заполнить реквизиты Podocare один раз.
2. На каждого заказчика: B2B-договор + DPA + приложение «Тариф v0.3» + выбранный трек A/B.
3. Передать заказчику B2C-шаблоны для публикации и вставки в white-label приложение.
4. Заказчик **сам** уведомляет Роскомнадзор как оператор ПДн (если обязан по закону).

## Связь с кодом

Тексты согласий: `apps/mobile/src/features/consents/consent-copy.ts` + `EXPO_PUBLIC_*` из [white-label-mobile.md](../white-label-mobile.md).
