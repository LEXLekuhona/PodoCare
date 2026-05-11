import { describe, expect, it } from 'vitest';

import {
  defaultOpeningHoursDraft,
  draftToOpeningHoursRecord,
  mergeOpeningHoursWithDraft,
  openingHoursToDraft,
  validateOpeningHoursDraft,
  type DayOpeningDraft,
} from './opening-hours-form';

function allClosedFromDefault(): DayOpeningDraft[] {
  return defaultOpeningHoursDraft().map((d) => ({ ...d, closed: true }));
}

describe('opening-hours-form', () => {
  it('validateOpeningHoursDraft: все дни выходные — ошибка', () => {
    expect(validateOpeningHoursDraft(allClosedFromDefault())).toMatch(/хотя бы один рабочий день/i);
  });

  it('validateOpeningHoursDraft: один рабочий день с корректным интервалом — ок', () => {
    const days = allClosedFromDefault().map((d) =>
      d.weekday === 0 ? { ...d, closed: false, open: '10:00', close: '18:00' } : d,
    );
    expect(validateOpeningHoursDraft(days)).toBeNull();
  });

  it('validateOpeningHoursDraft: закрытие раньше открытия — ошибка', () => {
    const days = allClosedFromDefault().map((d) =>
      d.weekday === 1 ? { ...d, closed: false, open: '18:00', close: '09:00' } : d,
    );
    expect(validateOpeningHoursDraft(days)).toMatch(/позже открытия/);
  });

  it('openingHoursToDraft: читает ключи дней и помечает отсутствующие как выходные', () => {
    const days = openingHoursToDraft({
      1: { open: '09:00', close: '21:00' },
    });
    const mon = days.find((d) => d.weekday === 1);
    const tue = days.find((d) => d.weekday === 2);
    expect(mon?.closed).toBe(false);
    expect(mon?.open).toBe('09:00');
    expect(tue?.closed).toBe(true);
  });

  it('mergeOpeningHoursWithDraft: без baseline даёт только расписание из формы', () => {
    const days = defaultOpeningHoursDraft();
    const merged = mergeOpeningHoursWithDraft(undefined, days);
    expect(merged).toEqual(draftToOpeningHoursRecord(days));
  });

  it('mergeOpeningHoursWithDraft: сохраняет сторонние ключи и перезаписывает дни 0–6', () => {
    const baseline = {
      meta: { version: 1 },
      1: { open: '08:00', close: '20:00' },
      '99': 'legacy',
    };
    const days = openingHoursToDraft({
      2: { open: '10:00', close: '19:00' },
    });
    const merged = mergeOpeningHoursWithDraft(baseline, days);
    expect(merged['meta']).toEqual({ version: 1 });
    expect(merged['99']).toBe('legacy');
    expect(merged['1']).toBeUndefined();
    expect(merged['2']).toEqual({ open: '10:00', close: '19:00' });
  });
});
