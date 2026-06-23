import Constants from 'expo-constants';

/** White-label бренд и юридические плейсхолдеры (EAS / `.env`). */
export type AppBranding = {
  /** Имя в UI (заголовки, splash). */
  brandName: string;
  /** Короткое имя (календарь устройства). */
  brandShortName: string;
  /** Юрлицо оператора ПДн (тексты согласий). */
  studioLegalName: string;
  /** Лицензиар платформы (упоминание в согласии на поручение обработки). */
  platformLegalName: string;
  privacyPolicyUrl: string;
  privacyEmail: string;
  supportEmail: string;
  /** Префикс темы обращения в поддержку. */
  supportTicketSubjectPrefix: string;
  calendarSourceTitle: string;
  calendarSourceId: string;
};

type BrandingExtra = {
  EXPO_PUBLIC_BRAND_NAME?: string;
  EXPO_PUBLIC_BRAND_SHORT_NAME?: string;
  EXPO_PUBLIC_STUDIO_LEGAL_NAME?: string;
  EXPO_PUBLIC_PLATFORM_LEGAL_NAME?: string;
  EXPO_PUBLIC_PRIVACY_POLICY_URL?: string;
  EXPO_PUBLIC_PRIVACY_EMAIL?: string;
  EXPO_PUBLIC_SUPPORT_EMAIL?: string;
};

const DEV_DEFAULTS: AppBranding = {
  brandName: 'Solodova Recovery System',
  brandShortName: 'Solodova',
  studioLegalName: 'Solodova Recovery System',
  platformLegalName: 'Podocare',
  privacyPolicyUrl: 'https://example.com/privacy',
  privacyEmail: 'privacy@solodova-recovery.ru',
  supportEmail: 'support@solodova.recovery',
  supportTicketSubjectPrefix: 'Solodova Recovery',
  calendarSourceTitle: 'Solodova',
  calendarSourceId: 'solodova_appointments',
};

function readExtra(): BrandingExtra {
  const extra = Constants.expoConfig?.extra;
  if (!extra || typeof extra !== 'object') return {};
  return extra as BrandingExtra;
}

function pickString(extraKey: keyof BrandingExtra, envKey: string, fallback: string): string {
  const extra = readExtra()[extraKey];
  if (typeof extra === 'string' && extra.trim().length > 0) return extra.trim();
  const fromEnv = process.env[envKey];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim();
  return fallback;
}

function slugifyCalendarId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base.length > 0 ? `${base}_appointments` : DEV_DEFAULTS.calendarSourceId;
}

let cached: AppBranding | null = null;

export function getAppBranding(): AppBranding {
  if (cached) return cached;

  const brandName = pickString('EXPO_PUBLIC_BRAND_NAME', 'EXPO_PUBLIC_BRAND_NAME', DEV_DEFAULTS.brandName);
  const brandShortName = pickString(
    'EXPO_PUBLIC_BRAND_SHORT_NAME',
    'EXPO_PUBLIC_BRAND_SHORT_NAME',
    DEV_DEFAULTS.brandShortName,
  );
  const studioLegalName = pickString(
    'EXPO_PUBLIC_STUDIO_LEGAL_NAME',
    'EXPO_PUBLIC_STUDIO_LEGAL_NAME',
    brandName,
  );
  const platformLegalName = pickString(
    'EXPO_PUBLIC_PLATFORM_LEGAL_NAME',
    'EXPO_PUBLIC_PLATFORM_LEGAL_NAME',
    DEV_DEFAULTS.platformLegalName,
  );
  const privacyPolicyUrl = pickString(
    'EXPO_PUBLIC_PRIVACY_POLICY_URL',
    'EXPO_PUBLIC_PRIVACY_POLICY_URL',
    DEV_DEFAULTS.privacyPolicyUrl,
  );
  const privacyEmail = pickString(
    'EXPO_PUBLIC_PRIVACY_EMAIL',
    'EXPO_PUBLIC_PRIVACY_EMAIL',
    DEV_DEFAULTS.privacyEmail,
  );
  const supportEmail = pickString(
    'EXPO_PUBLIC_SUPPORT_EMAIL',
    'EXPO_PUBLIC_SUPPORT_EMAIL',
    DEV_DEFAULTS.supportEmail,
  );

  cached = {
    brandName,
    brandShortName,
    studioLegalName,
    platformLegalName,
    privacyPolicyUrl,
    privacyEmail,
    supportEmail,
    supportTicketSubjectPrefix: brandShortName,
    calendarSourceTitle: brandShortName,
    calendarSourceId: slugifyCalendarId(brandShortName),
  };
  return cached;
}

/** Сброс кэша (тесты). */
export function resetAppBrandingCacheForTests(): void {
  cached = null;
}
