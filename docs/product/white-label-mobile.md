# White-label mobile (EAS)

Сборка отдельного приложения на сеть/студию: бренд, bundle id, API tenant.

Юридические тексты: `legal/b2c-*.md` → переменные ниже.

---

## Переменные окружения

### Стор и нативная оболочка (`app.config.ts`)

| Переменная | Пример | Назначение |
|------------|--------|------------|
| `EXPO_PUBLIC_APP_DISPLAY_NAME` | `Студия Пример` | Имя под иконкой |
| `EXPO_PUBLIC_APP_SLUG` | `studio-primer` | EAS project slug |
| `EXPO_PUBLIC_ANDROID_PACKAGE` | `com.studioprimer.app` | applicationId |
| `EXPO_PUBLIC_IOS_BUNDLE_ID` | `com.studioprimer.app` | bundle identifier |
| `EXPO_PUBLIC_APP_ICON` | `./assets/tenant/icon.png` | опционально |
| `EXPO_PUBLIC_APP_SCHEME` | `studioprimer` | deep links |

### Runtime UI и согласия (`src/shared/config/branding.ts`)

| Переменная | Пример |
|------------|--------|
| `EXPO_PUBLIC_API_BASE_URL` | `https://api.example.com/api/v1` |
| `EXPO_PUBLIC_BRAND_NAME` | `Студия Пример` |
| `EXPO_PUBLIC_BRAND_SHORT_NAME` | `Пример` |
| `EXPO_PUBLIC_STUDIO_LEGAL_NAME` | `ООО «Студия Пример»` |
| `EXPO_PUBLIC_PLATFORM_LEGAL_NAME` | `ООО «Подокеа»` |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | `https://studio.example.ru/privacy` |
| `EXPO_PUBLIC_PRIVACY_EMAIL` | `privacy@studio.example.ru` |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | `support@studio.example.ru` |
| `EXPO_PUBLIC_SUPPORT_PHONE` | `+74951234567` |

Без переменных dev использует дефолты **Solodova** из `branding.ts`.

---

## Пример `.env` для заказчика

```bash
EXPO_PUBLIC_API_BASE_URL=https://api.studio.example.com/api/v1
EXPO_PUBLIC_APP_DISPLAY_NAME=Студия Пример
EXPO_PUBLIC_APP_SLUG=studio-primer
EXPO_PUBLIC_ANDROID_PACKAGE=com.studioprimer.app
EXPO_PUBLIC_IOS_BUNDLE_ID=com.studioprimer.app
EXPO_PUBLIC_BRAND_NAME=Студия Пример
EXPO_PUBLIC_BRAND_SHORT_NAME=Пример
EXPO_PUBLIC_STUDIO_LEGAL_NAME=ООО «Студия Пример»
EXPO_PUBLIC_PLATFORM_LEGAL_NAME=ООО «Подокеа»
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://studio.example.ru/privacy
EXPO_PUBLIC_PRIVACY_EMAIL=privacy@studio.example.ru
EXPO_PUBLIC_SUPPORT_EMAIL=support@studio.example.ru
EXPO_PUBLIC_SUPPORT_PHONE=+74951234567
```

---

## EAS Build

```bash
cd apps/mobile
cp .env.example .env.tenant   # заполнить значениями заказчика
# eas secret: push vars or use eas.json env per profile

eas build --platform android --profile production
eas build --platform ios --profile production
```

Рекомендация: отдельный **EAS project** или profile `tenant-<slug>` с env из [customer-release-checklist.md](customer-release-checklist.md).

---

## Чеклист перед сборкой

- [ ] `networkId` создан в API, студия прошла онбординг
- [ ] Политика ПДн опубликована на `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- [ ] Иконка и скриншоты для стора (трек A/B)
- [ ] Версии согласий в API совместимы (`PERSONAL_DATA` 1.3, `MEDICAL_INFORMATION` 2.1)

---

## Release kit (трек B)

После `eas build` передать заказчику:

- Android: `.aab` из EAS
- iOS: TestFlight invite или `.ipa`
- Этот файл + заполненный `.env` (без секретов API, только публичные URL)
