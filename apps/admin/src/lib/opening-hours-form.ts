import { DEFAULT_OPENING_HOURS_JSON } from './default-opening-hours';

/** Ключ дня в JSON: 0 — вс, 1 — пн, … 6 — сб (как в JavaScript getDay). */
export const OPENING_HOURS_UI_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const OPENING_HOURS_WEEKDAY_LABEL: Record<number, string> = {
  0: 'Воскресенье',
  1: 'Понедельник',
  2: 'Вторник',
  3: 'Среда',
  4: 'Четверг',
  5: 'Пятница',
  6: 'Суббота',
};

export interface DayOpeningDraft {
  weekday: number;
  closed: boolean;
  open: string;
  close: string;
}

const TIME_RE = /^(\d{2}):(\d{2})$/;

export function isValidHhMm(value: string): boolean {
  const m = TIME_RE.exec(value.trim());
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

function parseDaySlot(raw: unknown): { open: string; close: string } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const open = (raw as { open?: unknown }).open;
  const close = (raw as { close?: unknown }).close;
  if (typeof open !== 'string' || typeof close !== 'string') return null;
  const o = open.trim();
  const c = close.trim();
  if (!isValidHhMm(o) || !isValidHhMm(c)) return null;
  return { open: o, close: c };
}

function minutes(hhmm: string): number {
  const m = TIME_RE.exec(hhmm.trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Читает openingHours из API (объект с ключами "0"…"6" или числовыми ключами). */
export function openingHoursToDraft(source: unknown): DayOpeningDraft[] {
  const map: Record<number, { open: string; close: string } | undefined> = {};
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    for (const k of Object.keys(source as Record<string, unknown>)) {
      const weekday = Number(k);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue;
      const slot = parseDaySlot((source as Record<string, unknown>)[k]);
      if (slot) map[weekday] = slot;
    }
  }
  return OPENING_HOURS_UI_ORDER.map((weekday) => {
    const slot = map[weekday];
    if (slot) {
      return { weekday, closed: false, open: slot.open, close: slot.close };
    }
    return { weekday, closed: true, open: '09:00', close: '21:00' };
  });
}

/** Собирает JSON-объект для API; закрытые дни не попадают в объект. */
export function draftToOpeningHoursRecord(days: DayOpeningDraft[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const d of days) {
    if (d.closed) continue;
    out[String(d.weekday)] = { open: d.open.trim(), close: d.close.trim() };
  }
  return out;
}

/**
 * При редактировании сохраняет произвольные поля в `openingHours`, не относящиеся к дням 0–6,
 * и полностью перезаписывает расписание по дням из формы.
 */
export function mergeOpeningHoursWithDraft(
  baseline: unknown | undefined,
  days: DayOpeningDraft[],
): Record<string, unknown> {
  const base =
    baseline && typeof baseline === 'object' && !Array.isArray(baseline)
      ? { ...(baseline as Record<string, unknown>) }
      : {};
  for (let w = 0; w <= 6; w += 1) {
    delete base[String(w)];
  }
  return { ...base, ...draftToOpeningHoursRecord(days) };
}

export function validateOpeningHoursDraft(days: DayOpeningDraft[]): string | null {
  if (!days.some((d) => !d.closed)) {
    return 'Отметьте хотя бы один рабочий день: снимите «Выходной» и укажите время открытия и закрытия.';
  }
  for (const d of days) {
    if (d.closed) continue;
    if (!isValidHhMm(d.open)) {
      return `${OPENING_HOURS_WEEKDAY_LABEL[d.weekday]}: укажите время открытия как ЧЧ:ММ (например 09:00).`;
    }
    if (!isValidHhMm(d.close)) {
      return `${OPENING_HOURS_WEEKDAY_LABEL[d.weekday]}: укажите время закрытия как ЧЧ:ММ (например 21:00).`;
    }
    const o = minutes(d.open);
    const c = minutes(d.close);
    if (o >= c) {
      return `${OPENING_HOURS_WEEKDAY_LABEL[d.weekday]}: время закрытия должно быть позже открытия.`;
    }
  }
  return null;
}

export function defaultOpeningHoursDraft(): DayOpeningDraft[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(DEFAULT_OPENING_HOURS_JSON);
  } catch {
    parsed = {};
  }
  return openingHoursToDraft(parsed);
}
