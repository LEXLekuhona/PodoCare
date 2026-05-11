import { AppointmentSource, UserRole } from '@srs/shared-types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { canManageStaff, canUseClinicalOperations } from '../lib/roles';
import { appointmentStatusLabelForPicker, formatRub } from './operations/clinical-shared';

import type { AppointmentRow, BookingSlotOption, StudioRow, VisitSaleCatalog } from './operations/clinical-shared';

type SpecialistListItem = {
  specialistProfileId: string;
  firstName: string;
  lastName: string;
};

type WalkInRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  linkedUserId: string | null;
};

const PHONE_PREFIX = '+7';

function walkInSearchQueryReady(q: string): boolean {
  const t = q.trim();
  if (t.length < 2) return false;
  const compact = t.replace(/\s/g, '');
  if (compact === '+7' || compact === '7') return false;
  return true;
}

function walkInCreatePhoneReady(phone: string): boolean {
  return phone.replace(/\D/g, '').length >= 10;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Понедельник недели, в которой лежит `reference` (локальный календарь). */
function startOfIsoWeekMonday(reference: Date): Date {
  const d = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Первый день сетки месяца: понедельник недели с 1 числа. */
function gridStartMonday(year: number, monthIndex: number): Date {
  const first = new Date(year, monthIndex, 1);
  return startOfIsoWeekMonday(first);
}

/** Последний день сетки: воскресенье недели с последним числом месяца. */
function gridEndSunday(year: number, monthIndex: number): Date {
  const last = new Date(year, monthIndex + 1, 0);
  const d = new Date(last.getFullYear(), last.getMonth(), last.getDate());
  const dow = d.getDay();
  const offsetToSunday = dow === 0 ? 0 : 7 - dow;
  d.setDate(d.getDate() + offsetToSunday);
  d.setHours(23, 59, 59, 999);
  return d;
}

function dayKeyFromStartsAt(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function clientDisplayName(row: AppointmentRow): string {
  if (row.client) {
    return `${row.client.firstName} ${row.client.lastName}`.trim();
  }
  if (row.walkIn) {
    return `${row.walkIn.firstName} ${row.walkIn.lastName}`.trim();
  }
  return 'Клиент';
}

function specialistShort(row: AppointmentRow): string | null {
  const u = row.specialist?.user;
  if (!u) return null;
  return `${u.firstName} ${u.lastName}`.trim();
}

function monthTitleRu(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function formatModalDayTitle(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function CalendarPage() {
  const { user } = useAuth();
  const allowed = user ? canUseClinicalOperations(user.role) : false;
  const isSpecialist = user?.role === UserRole.Specialist;
  const canPickSpecialistFilter = user ? canManageStaff(user.role) : false;

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [studioId, setStudioId] = useState('');
  const [specialistFilterId, setSpecialistFilterId] = useState('');
  const [specialists, setSpecialists] = useState<SpecialistListItem[]>([]);
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** yyyy-MM-dd выбранного дня для записи (специалист) */
  const [bookDayKey, setBookDayKey] = useState<string | null>(null);
  const [meSpecialistProfileId, setMeSpecialistProfileId] = useState<string | null>(null);
  const [bookStudioId, setBookStudioId] = useState('');
  const [searchQ, setSearchQ] = useState(PHONE_PREFIX);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchHits, setSearchHits] = useState<WalkInRow[]>([]);
  const [activeWalkIn, setActiveWalkIn] = useState<WalkInRow | null>(null);
  const [createLast, setCreateLast] = useState('');
  const [createFirst, setCreateFirst] = useState('');
  const [createPhone, setCreatePhone] = useState(PHONE_PREFIX);
  const [createBusy, setCreateBusy] = useState(false);
  const [visitCatalog, setVisitCatalog] = useState<VisitSaleCatalog | null>(null);
  const [bookServiceId, setBookServiceId] = useState('');
  const [slotOptions, setSlotOptions] = useState<BookingSlotOption[]>([]);
  const [slotStartsAt, setSlotStartsAt] = useState('');
  const [slotsBusy, setSlotsBusy] = useState(false);
  const [bookBusy, setBookBusy] = useState(false);
  const [bookNotice, setBookNotice] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);

  const gridStart = useMemo(() => gridStartMonday(viewYear, viewMonth), [viewYear, viewMonth]);
  const gridEnd = useMemo(() => gridEndSunday(viewYear, viewMonth), [viewYear, viewMonth]);

  const calendarCells = useMemo(() => {
    const cells: Array<{ date: Date; inMonth: boolean; key: string }> = [];
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
      const plain = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      cells.push({
        date: plain,
        inMonth: plain.getMonth() === viewMonth,
        key: dayKeyFromDate(plain),
      });
    }
    return cells;
  }, [gridStart, gridEnd, viewMonth]);

  useEffect(() => {
    if (!allowed || isSpecialist) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiRequest<StudioRow[]>('/admin/catalog/studios');
        if (cancelled) return;
        setStudios(data);
        setStudioId((prev) => (prev && data.some((s) => s.id === prev) ? prev : data[0]?.id ?? ''));
      } catch {
        if (!cancelled) {
          setStudios([]);
          setStudioId('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, isSpecialist]);

  useEffect(() => {
    if (!allowed || !isSpecialist) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiRequest<StudioRow[]>('/admin/catalog/studios');
        if (cancelled) return;
        setStudios(data);
      } catch {
        if (!cancelled) setStudios([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, isSpecialist]);

  useEffect(() => {
    if (!bookDayKey || !isSpecialist || !studios.length) return;
    setBookStudioId((prev) => (prev && studios.some((s) => s.id === prev) ? prev : studios[0]!.id));
  }, [studios, bookDayKey, isSpecialist]);

  useEffect(() => {
    if (!allowed || !isSpecialist) return;
    let cancelled = false;
    void (async () => {
      try {
        const me = await apiRequest<{ specialistProfileId: string | null }>('/me');
        if (cancelled) return;
        setMeSpecialistProfileId(me.specialistProfileId ?? null);
      } catch {
        if (!cancelled) setMeSpecialistProfileId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, isSpecialist]);

  useEffect(() => {
    if (!allowed || isSpecialist || !studioId.trim() || !canPickSpecialistFilter) {
      setSpecialists([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiRequest<
          Array<{ specialistProfileId: string | null; firstName: string; lastName: string }>
        >(`/admin/catalog/specialists?studioId=${encodeURIComponent(studioId.trim())}`);
        if (cancelled) return;
        setSpecialists(
          data.flatMap((item) =>
            item.specialistProfileId
              ? [
                  {
                    specialistProfileId: item.specialistProfileId,
                    firstName: item.firstName,
                    lastName: item.lastName,
                  },
                ]
              : [],
          ),
        );
      } catch {
        if (!cancelled) setSpecialists([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, isSpecialist, studioId, canPickSpecialistFilter]);

  const loadRange = useCallback(async () => {
    if (!allowed) return;
    if (!isSpecialist && !studioId.trim()) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const from = new Date(gridStart);
      from.setHours(0, 0, 0, 0);
      const to = new Date(gridEnd);
      to.setHours(23, 59, 59, 999);
      const q = new URLSearchParams();
      q.set('from', from.toISOString());
      q.set('to', to.toISOString());
      if (!isSpecialist) {
        q.set('studioId', studioId.trim());
        if (specialistFilterId.trim()) {
          q.set('specialistId', specialistFilterId.trim());
        }
      }
      const data = await apiRequest<AppointmentRow[]>(`/appointments?${q.toString()}`);
      setRows(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить записи');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, isSpecialist, studioId, specialistFilterId, gridStart, gridEnd]);

  useEffect(() => {
    void loadRange();
  }, [loadRange]);

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const cell of calendarCells) {
      map.set(cell.key, []);
    }
    for (const row of rows) {
      const key = dayKeyFromStartsAt(row.startsAt);
      if (!map.has(key)) continue;
      map.get(key)!.push(row);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [rows, calendarCells]);

  function goPrevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function goNextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  function goThisMonth() {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
  }

  function openBookModal(dayKey: string) {
    setBookDayKey(dayKey);
    setBookError(null);
    setBookNotice(null);
    setSearchQ(PHONE_PREFIX);
    setSearchHits([]);
    setActiveWalkIn(null);
    setCreateLast('');
    setCreateFirst('');
    setCreatePhone(PHONE_PREFIX);
    setVisitCatalog(null);
    setBookServiceId('');
    setSlotOptions([]);
    setSlotStartsAt('');
    const dayAppts = byDay.get(dayKey) ?? [];
    const studioFromAppt = dayAppts.find((a) => a.studioId)?.studioId;
    const initialStudio =
      studioFromAppt && studios.some((s) => s.id === studioFromAppt)
        ? studioFromAppt
        : studios[0]?.id ?? '';
    setBookStudioId(initialStudio);
  }

  function closeBookModal() {
    setBookDayKey(null);
  }

  useEffect(() => {
    if (!bookDayKey || !bookStudioId.trim() || !isSpecialist) {
      if (!bookDayKey) setVisitCatalog(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const catalog = await apiRequest<VisitSaleCatalog>(
          `/orders/visit-sale-catalog?studioId=${encodeURIComponent(bookStudioId.trim())}`,
        );
        if (cancelled) return;
        setVisitCatalog(catalog);
        setBookServiceId(catalog.services[0]?.id ?? '');
      } catch (e) {
        if (cancelled) return;
        setVisitCatalog(null);
        if (e instanceof ApiError) setBookError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookDayKey, bookStudioId, isSpecialist]);

  const loadBookSlots = useCallback(async () => {
    if (!bookDayKey || !bookStudioId.trim() || !bookServiceId.trim() || !meSpecialistProfileId) {
      setSlotOptions([]);
      setSlotStartsAt('');
      return;
    }
    setSlotsBusy(true);
    try {
      const q = new URLSearchParams({
        studioId: bookStudioId.trim(),
        specialistId: meSpecialistProfileId,
        serviceId: bookServiceId.trim(),
        days: '1',
        fromDate: bookDayKey,
      });
      const data = await apiRequest<{
        days: Array<{
          date: string;
          disabled: boolean;
          slots: Array<{ startsAt: string; label: string; available: boolean }>;
        }>;
      }>(`/appointments/booking-slots?${q.toString()}`);
      const options: BookingSlotOption[] = [];
      for (const day of data.days) {
        if (day.disabled) continue;
        for (const sl of day.slots) {
          if (sl.available) {
            options.push({
              startsAt: sl.startsAt,
              label: sl.label,
              dateLabel: day.date,
            });
          }
        }
      }
      setSlotOptions(options);
      setSlotStartsAt(options[0]?.startsAt ?? '');
    } catch (e) {
      setSlotOptions([]);
      setSlotStartsAt('');
      if (e instanceof ApiError) setBookError(e.message);
    } finally {
      setSlotsBusy(false);
    }
  }, [bookDayKey, bookStudioId, bookServiceId, meSpecialistProfileId]);

  useEffect(() => {
    if (!bookDayKey || !activeWalkIn || !bookServiceId.trim()) {
      if (!bookDayKey) return;
      if (!activeWalkIn) {
        setSlotOptions([]);
        setSlotStartsAt('');
      }
      return;
    }
    void loadBookSlots();
  }, [bookDayKey, activeWalkIn?.id, bookServiceId, loadBookSlots]);

  async function runWalkInSearch() {
    if (!bookStudioId.trim() || !walkInSearchQueryReady(searchQ)) {
      setSearchHits([]);
      return;
    }
    setSearchBusy(true);
    setBookError(null);
    try {
      const q = new URLSearchParams({
        studioId: bookStudioId.trim(),
        q: searchQ.trim(),
      });
      const list = await apiRequest<WalkInRow[]>(`/appointments/walk-in-clients?${q.toString()}`);
      setSearchHits(list);
    } catch (e) {
      setSearchHits([]);
      if (e instanceof ApiError) setBookError(e.message);
    } finally {
      setSearchBusy(false);
    }
  }

  async function runWalkInCreate() {
    if (!bookStudioId.trim() || !createFirst.trim() || !createLast.trim() || !walkInCreatePhoneReady(createPhone))
      return;
    setCreateBusy(true);
    setBookError(null);
    setBookNotice(null);
    try {
      const row = await apiRequest<WalkInRow>(`/appointments/walk-in-clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studioId: bookStudioId.trim(),
          firstName: createFirst.trim(),
          lastName: createLast.trim(),
          phone: createPhone.trim(),
        }),
      });
      setActiveWalkIn(row);
      setBookNotice('Карточка создана — выберите время');
      setSearchHits([]);
    } catch (e) {
      if (e instanceof ApiError) setBookError(e.message);
    } finally {
      setCreateBusy(false);
    }
  }

  async function runBookAppointment() {
    if (!activeWalkIn || !bookStudioId.trim() || !bookServiceId.trim() || !slotStartsAt || !meSpecialistProfileId)
      return;
    setBookBusy(true);
    setBookError(null);
    setBookNotice(null);
    try {
      await apiRequest(`/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studioId: bookStudioId.trim(),
          specialistId: meSpecialistProfileId,
          serviceId: bookServiceId.trim(),
          walkInClientId: activeWalkIn.id,
          startsAt: slotStartsAt,
          source: AppointmentSource.Studio,
          specialistNote: 'Запись из календаря',
        }),
      });
      setBookNotice('Клиент записан');
      await loadRange();
      closeBookModal();
    } catch (e) {
      if (e instanceof ApiError) setBookError(e.message);
    } finally {
      setBookBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div className="page-shell">
        <p>Недостаточно прав для просмотра календаря.</p>
      </div>
    );
  }

  const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const todayKey = dayKeyFromDate(new Date());

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Календарь</h1>
        <p className="page-subtitle">
          {isSpecialist
            ? 'Месяц и ваши записи. Нажмите на день, чтобы записать клиента.'
            : 'Записи выбранной студии за месяц (при необходимости — один специалист).'}
        </p>
      </div>

      {!isSpecialist ? (
        <div
          className="surface-card"
          style={{
            marginBottom: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            alignItems: 'end',
          }}
        >
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="cal-studio">Студия</label>
            <select
              id="cal-studio"
              value={studioId}
              onChange={(e) => {
                setStudioId(e.target.value);
                setSpecialistFilterId('');
              }}
            >
              {studios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.city})
                </option>
              ))}
            </select>
          </div>
          {canPickSpecialistFilter ? (
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="cal-spec">Специалист</label>
              <select
                id="cal-spec"
                value={specialistFilterId}
                onChange={(e) => setSpecialistFilterId(e.target.value)}
              >
                <option value="">Все специалисты</option>
                {specialists.map((s) => (
                  <option key={s.specialistProfileId} value={s.specialistProfileId}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="surface-card" style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{monthTitleRu(viewYear, viewMonth)}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" onClick={goPrevMonth}>
              ← Месяц
            </button>
            <button type="button" className="primary" onClick={goThisMonth}>
              Сегодня
            </button>
            <button type="button" onClick={goNextMonth}>
              Месяц →
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="surface-card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="surface-card">Загрузка…</div>
      ) : (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(96px, 1fr))',
              gap: '2px',
              minWidth: '560px',
              background: 'var(--border)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              border: '1px solid var(--border)',
            }}
          >
            {weekdayLabels.map((wd) => (
              <div
                key={wd}
                style={{
                  padding: '0.45rem 0.35rem',
                  textAlign: 'center',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  background: 'var(--surface-weak)',
                }}
              >
                {wd}
              </div>
            ))}
            {calendarCells.map((cell) => {
              const dayRows = byDay.get(cell.key) ?? [];
              const isToday = cell.key === todayKey;
              const interactive = isSpecialist && meSpecialistProfileId;
              return (
                <div
                  key={cell.key}
                  role={interactive ? 'button' : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  onClick={() => {
                    if (interactive) openBookModal(cell.key);
                  }}
                  onKeyDown={(ev) => {
                    if (interactive && (ev.key === 'Enter' || ev.key === ' ')) {
                      ev.preventDefault();
                      openBookModal(cell.key);
                    }
                  }}
                  style={{
                    minHeight: '108px',
                    padding: '0.35rem',
                    background: 'var(--surface)',
                    opacity: cell.inMonth ? 1 : 0.52,
                    outline: isToday ? '2px solid var(--accent)' : undefined,
                    outlineOffset: '-1px',
                    cursor: interactive ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    {cell.date.getDate()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', overflow: 'hidden' }}>
                    {dayRows.slice(0, 4).map((row) => {
                      const time = new Date(row.startsAt).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const spec = specialistShort(row);
                      return (
                        <div
                          key={row.id}
                          title={`${clientDisplayName(row)} · ${appointmentStatusLabelForPicker(row.status, row.endsAt)}`}
                          style={{
                            fontSize: '0.68rem',
                            lineHeight: 1.25,
                            padding: '0.12rem 0.28rem',
                            borderRadius: '6px',
                            background: 'var(--surface-weak)',
                            border: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                          }}
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          <span style={{ fontWeight: 600 }}>{time}</span> {clientDisplayName(row)}
                          {row.service?.name ? (
                            <span style={{ color: 'var(--muted)' }}> · {row.service.name}</span>
                          ) : null}
                          {!isSpecialist && spec ? (
                            <span style={{ color: 'var(--muted)' }}> · {spec}</span>
                          ) : null}
                        </div>
                      );
                    })}
                    {dayRows.length > 4 ? (
                      <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>+{dayRows.length - 4}</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bookDayKey && isSpecialist ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 35, 28, 0.45)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) closeBookModal();
          }}
        >
          <div
            className="surface-card"
            style={{ maxWidth: 520, width: '100%', maxHeight: '90vh', overflow: 'auto', position: 'relative' }}
            onMouseDown={(ev) => ev.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeBookModal}
              style={{ position: 'absolute', top: '0.65rem', right: '0.65rem' }}
            >
              Закрыть
            </button>
            <h2 style={{ fontSize: '1.1rem', marginTop: 0, paddingRight: '4rem' }}>
              Запись на {formatModalDayTitle(bookDayKey)}
            </h2>
            {!meSpecialistProfileId ? (
              <p style={{ color: 'var(--danger)' }}>Не найден профиль специалиста. Обратитесь к администратору.</p>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="book-studio">Студия</label>
                  <select
                    id="book-studio"
                    value={bookStudioId}
                    onChange={(ev) => {
                      setBookStudioId(ev.target.value);
                      setActiveWalkIn(null);
                      setSearchHits([]);
                    }}
                  >
                    {studios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.city})
                      </option>
                    ))}
                  </select>
                </div>

                {bookError ? <div className="error-banner">{bookError}</div> : null}
                {bookNotice ? <div className="success-banner">{bookNotice}</div> : null}

                <h3 style={{ fontSize: '0.98rem' }}>Клиент</h3>
                <div className="field" style={{ marginBottom: '0.5rem' }}>
                  <label htmlFor="book-q">Поиск по телефону или ФИО</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input id="book-q" value={searchQ} onChange={(ev) => setSearchQ(ev.target.value)} style={{ flex: 1, minWidth: 160 }} />
                    <button type="button" onClick={() => void runWalkInSearch()} disabled={searchBusy || !walkInSearchQueryReady(searchQ)}>
                      {searchBusy ? '…' : 'Найти'}
                    </button>
                  </div>
                </div>
                {searchHits.length > 0 ? (
                  <ul style={{ margin: '0 0 0.75rem', paddingLeft: '1.1rem' }}>
                    {searchHits.map((h) => (
                      <li key={h.id} style={{ marginBottom: '0.25rem' }}>
                        <button
                          type="button"
                          className={activeWalkIn?.id === h.id ? 'primary' : undefined}
                          onClick={() => {
                            setActiveWalkIn(h);
                            setBookNotice(null);
                          }}
                        >
                          {h.lastName} {h.firstName} · {h.phone}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.25rem 0' }}>Новая карточка</p>
                <div className="field" style={{ maxWidth: 280 }}>
                  <label htmlFor="book-ln">Фамилия</label>
                  <input id="book-ln" value={createLast} onChange={(ev) => setCreateLast(ev.target.value)} />
                </div>
                <div className="field" style={{ maxWidth: 280 }}>
                  <label htmlFor="book-fn">Имя</label>
                  <input id="book-fn" value={createFirst} onChange={(ev) => setCreateFirst(ev.target.value)} />
                </div>
                <div className="field" style={{ maxWidth: 280 }}>
                  <label htmlFor="book-ph">Телефон</label>
                  <input id="book-ph" value={createPhone} onChange={(ev) => setCreatePhone(ev.target.value)} />
                </div>
                <button
                  type="button"
                  onClick={() => void runWalkInCreate()}
                  disabled={createBusy || !createFirst.trim() || !createLast.trim() || !walkInCreatePhoneReady(createPhone)}
                >
                  {createBusy ? '…' : 'Создать карточку'}
                </button>

                {activeWalkIn ? (
                  <>
                    <h3 style={{ fontSize: '0.98rem', marginTop: '1rem' }}>
                      Приём: {activeWalkIn.lastName} {activeWalkIn.firstName}
                    </h3>
                    {!visitCatalog?.services.length ? (
                      <p style={{ color: 'var(--muted)' }}>
                        {visitCatalog ? 'Нет услуг в каталоге студии.' : 'Загрузка услуг…'}
                      </p>
                    ) : (
                      <>
                        <div className="field">
                          <label htmlFor="book-svc">Услуга</label>
                          <select id="book-svc" value={bookServiceId} onChange={(ev) => setBookServiceId(ev.target.value)}>
                            {visitCatalog.services.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.durationMinutes} мин, {formatRub(s.priceMinor)})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="book-slot">Время</label>
                          <select
                            id="book-slot"
                            value={slotStartsAt}
                            onChange={(ev) => setSlotStartsAt(ev.target.value)}
                            disabled={slotsBusy || slotOptions.length === 0}
                          >
                            {slotOptions.length === 0 ? (
                              <option value="">{slotsBusy ? 'Загрузка…' : 'Нет свободных слотов на этот день'}</option>
                            ) : (
                              slotOptions.map((opt) => (
                                <option key={opt.startsAt} value={opt.startsAt}>
                                  {opt.label}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                          <button type="button" onClick={() => void loadBookSlots()} disabled={slotsBusy}>
                            Обновить слоты
                          </button>
                          <button
                            type="button"
                            className="primary"
                            onClick={() => void runBookAppointment()}
                            disabled={bookBusy || !slotStartsAt || slotOptions.length === 0}
                          >
                            {bookBusy ? '…' : 'Записать'}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.75rem' }}>
                    Выберите клиента из поиска или создайте карточку.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
