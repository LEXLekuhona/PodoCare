import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from './app.json';

const base = appJson.expo;

function env(key: string, fallback: string): string {
  const v = process.env[key];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;
}

export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    ...base,
    name: env('EXPO_PUBLIC_APP_DISPLAY_NAME', base.name),
    slug: env('EXPO_PUBLIC_APP_SLUG', base.slug),
    icon: env('EXPO_PUBLIC_APP_ICON', base.icon),
    scheme: env('EXPO_PUBLIC_APP_SCHEME', base.scheme),
    splash: {
      ...base.splash,
      backgroundColor: env('EXPO_PUBLIC_SPLASH_BACKGROUND', base.splash?.backgroundColor ?? '#ffffff'),
    },
    ios: {
      ...base.ios,
      bundleIdentifier: env('EXPO_PUBLIC_IOS_BUNDLE_ID', 'com.srs.solodova'),
    },
    android: {
      ...base.android,
      package: env('EXPO_PUBLIC_ANDROID_PACKAGE', base.android?.package ?? 'com.srs.solodova'),
      adaptiveIcon: {
        ...base.android?.adaptiveIcon,
        backgroundColor: env(
          'EXPO_PUBLIC_ADAPTIVE_ICON_BACKGROUND',
          base.android?.adaptiveIcon?.backgroundColor ?? '#ffffff',
        ),
      },
    },
    extra: {
      ...((base as { extra?: Record<string, unknown> }).extra ?? {}),
      EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
      EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
      EXPO_PUBLIC_SUPPORT_PHONE: process.env.EXPO_PUBLIC_SUPPORT_PHONE,
      EXPO_PUBLIC_BRAND_NAME: process.env.EXPO_PUBLIC_BRAND_NAME,
      EXPO_PUBLIC_BRAND_SHORT_NAME: process.env.EXPO_PUBLIC_BRAND_SHORT_NAME,
      EXPO_PUBLIC_STUDIO_LEGAL_NAME: process.env.EXPO_PUBLIC_STUDIO_LEGAL_NAME,
      EXPO_PUBLIC_PLATFORM_LEGAL_NAME: process.env.EXPO_PUBLIC_PLATFORM_LEGAL_NAME,
      EXPO_PUBLIC_PRIVACY_POLICY_URL: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
      EXPO_PUBLIC_PRIVACY_EMAIL: process.env.EXPO_PUBLIC_PRIVACY_EMAIL,
    },
  }) as ExpoConfig;
