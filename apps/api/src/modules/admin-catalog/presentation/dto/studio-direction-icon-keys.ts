/** Допустимые ключи иконок Font Awesome 5 (solid) в мобильном клиенте. */
export const STUDIO_DIRECTION_ICON_KEYS = [
  'spa',
  'shoe-prints',
  'leaf',
  'hands',
  'magic',
  'heartbeat',
  'medkit',
  'seedling',
  'star',
] as const;

export type StudioDirectionIconKey = (typeof STUDIO_DIRECTION_ICON_KEYS)[number];
