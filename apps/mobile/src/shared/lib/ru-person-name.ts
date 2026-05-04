/** Нормализация имени/фамилии для русской локали (как на экране регистрации). */
export function normalizeRuPersonName(input: string) {
  const cleaned = input.replace(/[^А-Яа-яЁё -]/g, '');
  const normalized = cleaned
    .replace(/[ -]{2,}/g, ' ')
    .replace(/^-+/, '')
    .replace(/^ +/, '')
    .replace(/ +$/, '')
    .slice(0, 60);

  return normalized
    .split(' ')
    .map((part) =>
      part
        .split('-')
        .map((w) => {
          const word = w.trim();
          if (!word) return '';
          const first = word[0] ?? '';
          const rest = word.slice(1);
          return first.toUpperCase() + rest.toLowerCase();
        })
        .filter(Boolean)
        .join('-'),
    )
    .filter(Boolean)
    .join(' ');
}

export function isValidRuPersonName(value: string) {
  const v = value.trim();
  if (v.length < 2) return false;
  return /^[А-Яа-яЁё]+(?:[ -][А-Яа-яЁё]+)*$/.test(v);
}
