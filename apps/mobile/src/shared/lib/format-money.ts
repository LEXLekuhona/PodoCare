/** `priceMinor` — минорные единицы валюты (копейки для RUB). */
export function formatMinorCurrency(minor: number, currency: string): string {
  const units = minor / 100;
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(units);
  } catch {
    return `${units.toLocaleString('ru-RU')} ${currency}`;
  }
}
