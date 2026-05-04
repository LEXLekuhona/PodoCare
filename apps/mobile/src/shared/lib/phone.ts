/**
 * Нормализует номер для российского клиента в E.164 (+7XXXXXXXXXX).
 * Принимает 10 цифр без кода страны или 11 цифр с ведущей 7/8 и лишними хвостами.
 */
/** Отображение номера из E.164 (+7…) в виде +7 (999) 123-45-67 */
export function formatRuPhoneDisplay(e164ish: string): string {
  const d = e164ish.replace(/\D/g, '');
  let digits = d.startsWith('7') && d.length >= 11 ? d.slice(1) : d;
  digits = digits.slice(0, 10);
  if (digits.length !== 10) return e164ish;
  return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}

export function digitsToRuE164(digitsRaw: string): string {
  let digits = digitsRaw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  }
  if (digits.length >= 11 && digits.startsWith('7')) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);
  if (digits.length !== 10) {
    throw new Error('Ожидается 10 цифр номера после +7');
  }
  return `+7${digits}`;
}
