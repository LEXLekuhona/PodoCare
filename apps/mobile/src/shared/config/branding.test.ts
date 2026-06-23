jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} },
  },
}));

import { describe, expect, it, beforeEach } from '@jest/globals';

import { getPersonalDataParagraphs } from '@/features/consents/consent-copy';
import { getAppBranding, resetAppBrandingCacheForTests } from '@/shared/config/branding';

describe('white-label branding', () => {
  beforeEach(() => {
    resetAppBrandingCacheForTests();
    delete process.env.EXPO_PUBLIC_BRAND_NAME;
    delete process.env.EXPO_PUBLIC_STUDIO_LEGAL_NAME;
    delete process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  });

  it('uses studio legal name in personal data consent', () => {
    process.env.EXPO_PUBLIC_BRAND_NAME = 'Клиника Тест';
    process.env.EXPO_PUBLIC_STUDIO_LEGAL_NAME = 'ООО «Клиника Тест»';
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL = 'https://test.example/privacy';

    const paragraphs = getPersonalDataParagraphs();
    expect(paragraphs[0]).toContain('ООО «Клиника Тест»');
    expect(paragraphs.join('\n')).toContain('https://test.example/privacy');
    expect(paragraphs.join('\n')).toContain('«Клиника Тест»');
  });

  it('defaults brand name for dev', () => {
    expect(getAppBranding().brandName).toBe('Solodova Recovery System');
  });
});
