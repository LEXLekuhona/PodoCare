export type ConcernIconKey = 'fungus' | 'nail' | 'sweat' | 'corn' | 'default';

const RULES: Array<{ key: ConcernIconKey; terms: string[] }> = [
  { key: 'fungus', terms: ['гриб', 'микоз', 'онихомик'] },
  { key: 'nail', terms: ['врос', 'ногт', 'онихо', 'трещ'] },
  { key: 'sweat', terms: ['потлив', 'гипергид'] },
  { key: 'corn', terms: ['мозол', 'натопт'] },
];

export function resolveConcernIconKey(title: string): ConcernIconKey {
  const normalized = title.trim().toLowerCase();
  for (const rule of RULES) {
    if (rule.terms.some((term) => normalized.includes(term))) {
      return rule.key;
    }
  }
  return 'default';
}
