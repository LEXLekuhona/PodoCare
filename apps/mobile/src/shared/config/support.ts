/**
 * Контакты поддержки (опционально через EXPO_PUBLIC_* в .env / EAS).
 * Если не заданы — в UI показываем только FAQ и общий текст.
 */
export function getSupportEmail(): string | null {
  const v = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
  return typeof v === 'string' && v.includes('@') ? v.trim() : null;
}

export function getSupportPhoneE164(): string | null {
  const v = process.env.EXPO_PUBLIC_SUPPORT_PHONE;
  if (typeof v !== 'string' || v.trim().length < 8) return null;
  return v.trim().replace(/\s+/g, '');
}
