import { AppointmentSource, UserRole } from '@srs/shared-types';
import { useCallback, useEffect, useState } from 'react';

import { formatRub } from './clinical-shared';
import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { canUseClinicalOperations } from '../../lib/roles';

import type { BookingSlotOption, StudioRow, VisitSaleCatalog } from './clinical-shared';

type WalkInRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  linkedUserId: string | null;
  createdAt: string;
};

type SpecialistListRow = {
  id: string;
  firstName: string;
  lastName: string;
  specialistProfileId: string | null;
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
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
}

export function WalkInClientPage() {
  const { user } = useAuth();
  const allowed = user ? canUseClinicalOperations(user.role) : false;
  const isSpecialist = user?.role === UserRole.Specialist;

  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [studioId, setStudioId] = useState('');
  const [searchQ, setSearchQ] = useState(PHONE_PREFIX);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchHits, setSearchHits] = useState<WalkInRow[]>([]);
  const [activeWalkIn, setActiveWalkIn] = useState<WalkInRow | null>(null);

  const [createLast, setCreateLast] = useState('');
  const [createFirst, setCreateFirst] = useState('');
  const [createPhone, setCreatePhone] = useState(PHONE_PREFIX);
  const [createBusy, setCreateBusy] = useState(false);

  const [meSpecialistProfileId, setMeSpecialistProfileId] = useState<string | null>(null);
  const [specialists, setSpecialists] = useState<SpecialistListRow[]>([]);
  const [pickedSpecialistProfileId, setPickedSpecialistProfileId] = useState('');

  const [visitCatalog, setVisitCatalog] = useState<VisitSaleCatalog | null>(null);
  const [bookServiceId, setBookServiceId] = useState('');
  const [slotOptions, setSlotOptions] = useState<BookingSlotOption[]>([]);
  const [slotStartsAt, setSlotStartsAt] = useState('');
  const [slotsBusy, setSlotsBusy] = useState(false);
  const [bookBusy, setBookBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const specialistProfileIdForBooking = isSpecialist
    ? meSpecialistProfileId ?? ''
    : pickedSpecialistProfileId;

  useEffect(() => {
    if (!allowed) return;
    void (async () => {
      try {
        const data = await apiRequest<StudioRow[]>('/admin/catalog/studios');
        setStudios(data);
        setStudioId((prev) => prev || data[0]?.id || '');
      } catch {
        setStudios([]);
      }
    })();
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    void (async () => {
      try {
        const me = await apiRequest<{ specialistProfileId: string | null }>('/me');
        setMeSpecialistProfileId(me.specialistProfileId ?? null);
      } catch {
        setMeSpecialistProfileId(null);
      }
    })();
  }, [allowed]);

  useEffect(() => {
    if (isSpecialist && meSpecialistProfileId) {
      setPickedSpecialistProfileId(meSpecialistProfileId);
    }
  }, [isSpecialist, meSpecialistProfileId]);

  useEffect(() => {
    if (!allowed || isSpecialist || !studioId.trim()) {
      if (!isSpecialist) setSpecialists([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await apiRequest<SpecialistListRow[]>(
          `/admin/catalog/specialists?studioId=${encodeURIComponent(studioId.trim())}`,
        );
        if (cancelled) return;
        setSpecialists(rows);
        setPickedSpecialistProfileId((prev) => {
          if (prev && rows.some((r) => r.specialistProfileId === prev)) return prev;
          return rows.find((r) => r.specialistProfileId)?.specialistProfileId ?? '';
        });
      } catch {
        if (!cancelled) setSpecialists([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, isSpecialist, studioId]);

  useEffect(() => {
    if (!allowed || !activeWalkIn || !studioId.trim()) {
      setVisitCatalog(null);
      setBookServiceId('');
      setSlotOptions([]);
      setSlotStartsAt('');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const catalog = await apiRequest<VisitSaleCatalog>(
          `/orders/visit-sale-catalog?studioId=${encodeURIComponent(studioId.trim())}`,
        );
        if (cancelled) return;
        setVisitCatalog(catalog);
        setBookServiceId(catalog.services[0]?.id ?? '');
      } catch (e) {
        if (cancelled) return;
        setVisitCatalog(null);
        if (e instanceof ApiError) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, activeWalkIn?.id, studioId]);

  const loadSlots = useCallback(async () => {
    if (!studioId.trim() || !bookServiceId.trim() || !specialistProfileIdForBooking) {
      setSlotOptions([]);
      setSlotStartsAt('');
      return;
    }
    setSlotsBusy(true);
    try {
      const q = new URLSearchParams({
        studioId: studioId.trim(),
        specialistId: specialistProfileIdForBooking,
        serviceId: bookServiceId.trim(),
        days: '21',
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
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setSlotsBusy(false);
    }
  }, [studioId, bookServiceId, specialistProfileIdForBooking]);

  useEffect(() => {
    if (!activeWalkIn || !bookServiceId) {
      setSlotOptions([]);
      setSlotStartsAt('');
      return;
    }
    void loadSlots();
  }, [activeWalkIn?.id, bookServiceId, loadSlots]);

  async function runSearch() {
    if (!studioId.trim() || !walkInSearchQueryReady(searchQ)) {
      setSearchHits([]);
      return;
    }
    setSearchBusy(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        studioId: studioId.trim(),
        q: searchQ.trim(),
      });
      const rows = await apiRequest<WalkInRow[]>(`/appointments/walk-in-clients?${q.toString()}`);
      setSearchHits(rows);
    } catch (e) {
      setSearchHits([]);
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setSearchBusy(false);
    }
  }

  async function runCreate() {
    if (!studioId.trim() || !createFirst.trim() || !createLast.trim() || !walkInCreatePhoneReady(createPhone)) return;
    setCreateBusy(true);
    setError(null);
    setNotice(null);
    try {
      const row = await apiRequest<WalkInRow>(`/appointments/walk-in-clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studioId: studioId.trim(),
          firstName: createFirst.trim(),
          lastName: createLast.trim(),
          phone: createPhone.trim(),
        }),
      });
      setActiveWalkIn(row);
      setNotice('Карточка создана — можно записать на приём');
      setSearchHits([]);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setCreateBusy(false);
    }
  }

  async function runBook() {
    if (!activeWalkIn || !studioId.trim() || !bookServiceId.trim() || !slotStartsAt || !specialistProfileIdForBooking)
      return;
    setBookBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studioId: studioId.trim(),
          specialistId: specialistProfileIdForBooking,
          serviceId: bookServiceId.trim(),
          walkInClientId: activeWalkIn.id,
          startsAt: slotStartsAt,
          source: AppointmentSource.Studio,
          specialistNote: 'Запись walk-in без приложения',
        }),
      });
      setNotice('Клиент записан на приём');
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setBookBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <h1 className="page-title">Клиент без приложения</h1>
          <p className="page-subtitle">Недостаточно прав.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Клиент без приложения (walk-in)</h1>
        <p className="page-subtitle">
          Поиск по телефону или ФИО, новая карточка и запись на приём. Данные остаются в базе; при входе в приложении по
          тому же телефону карточки привязываются к аккаунту.
        </p>
      </div>

      <div className="surface-card" style={{ marginBottom: '1rem' }}>
        <div className="field" style={{ maxWidth: 420 }}>
          <label htmlFor="wi-studio">Студия</label>
          <select
            id="wi-studio"
            value={studioId}
            onChange={(ev) => {
              setStudioId(ev.target.value);
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

        {!isSpecialist ? (
          <div className="field" style={{ maxWidth: 420 }}>
            <label htmlFor="wi-spec">Специалист</label>
            <select
              id="wi-spec"
              value={pickedSpecialistProfileId}
              onChange={(ev) => setPickedSpecialistProfileId(ev.target.value)}
              disabled={!studioId || specialists.length === 0}
            >
              {specialists.filter((s) => s.specialistProfileId).length === 0 ? (
                <option value="">Нет специалистов для студии</option>
              ) : (
                specialists
                  .filter((s) => s.specialistProfileId)
                  .map((s) => (
                    <option key={s.specialistProfileId!} value={s.specialistProfileId!}>
                      {s.lastName} {s.firstName}
                    </option>
                  ))
              )}
            </select>
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            Запись ведётся на вас (специалиста). Убедитесь, что в студии есть смена на выбранное время.
          </p>
        )}
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? <div className="success-banner">{notice}</div> : null}

      <div className="surface-card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>Найти по телефону или ФИО</h2>
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label htmlFor="wi-q">Запрос (от 2 символов)</label>
            <input
              id="wi-q"
              value={searchQ}
              onChange={(ev) => setSearchQ(ev.target.value)}
              placeholder="цифры номера или ФИО"
            />
          </div>
          <button type="button" onClick={() => void runSearch()} disabled={searchBusy || !walkInSearchQueryReady(searchQ)}>
            {searchBusy ? '…' : 'Найти'}
          </button>
        </div>
        {searchHits.length > 0 ? (
          <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem' }}>
            {searchHits.map((h) => (
              <li key={h.id} style={{ marginBottom: '0.35rem' }}>
                <button
                  type="button"
                  className={activeWalkIn?.id === h.id ? 'primary' : undefined}
                  onClick={() => {
                    setActiveWalkIn(h);
                    setNotice(null);
                  }}
                >
                  {h.lastName} {h.firstName} · {h.phone}
                </button>
                {h.linkedUserId ? (
                  <span style={{ color: 'var(--muted)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                    (привязан к приложению)
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="surface-card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>Новая карточка</h2>
        <div className="field" style={{ maxWidth: 280 }}>
          <label htmlFor="wi-ln">Фамилия</label>
          <input id="wi-ln" value={createLast} onChange={(ev) => setCreateLast(ev.target.value)} />
        </div>
        <div className="field" style={{ maxWidth: 280 }}>
          <label htmlFor="wi-fn">Имя</label>
          <input id="wi-fn" value={createFirst} onChange={(ev) => setCreateFirst(ev.target.value)} />
        </div>
        <div className="field" style={{ maxWidth: 280 }}>
          <label htmlFor="wi-ph">Телефон</label>
          <input id="wi-ph" value={createPhone} onChange={(ev) => setCreatePhone(ev.target.value)} placeholder="9123456789" />
        </div>
        <button
          type="button"
          className="primary"
          onClick={() => void runCreate()}
          disabled={createBusy || !createFirst.trim() || !createLast.trim() || !walkInCreatePhoneReady(createPhone)}
        >
          {createBusy ? '…' : 'Создать карточку'}
        </button>
      </div>

      {activeWalkIn ? (
        <div className="surface-card">
          <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>
            Запись: {activeWalkIn.lastName} {activeWalkIn.firstName} · {activeWalkIn.phone}
          </h2>
          {!visitCatalog?.services.length ? (
            <p style={{ color: 'var(--muted)' }}>{visitCatalog ? 'Нет услуг в каталоге.' : 'Загрузка каталога…'}</p>
          ) : (
            <>
              <div className="field" style={{ maxWidth: 480 }}>
                <label htmlFor="wi-svc">Услуга</label>
                <select id="wi-svc" value={bookServiceId} onChange={(ev) => setBookServiceId(ev.target.value)}>
                  {visitCatalog.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.durationMinutes} мин, {formatRub(s.priceMinor)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ maxWidth: 480 }}>
                <label htmlFor="wi-slot">Дата и время</label>
                <select
                  id="wi-slot"
                  value={slotStartsAt}
                  onChange={(ev) => setSlotStartsAt(ev.target.value)}
                  disabled={slotsBusy || slotOptions.length === 0}
                >
                  {slotOptions.length === 0 ? (
                    <option value="">{slotsBusy ? 'Загрузка слотов…' : 'Нет свободных слотов'}</option>
                  ) : (
                    slotOptions.map((opt) => (
                      <option key={opt.startsAt} value={opt.startsAt}>
                        {opt.dateLabel} {opt.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="toolbar" style={{ marginBottom: 0 }}>
                <button type="button" onClick={() => void loadSlots()} disabled={slotsBusy}>
                  Обновить слоты
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => void runBook()}
                  disabled={
                    bookBusy ||
                    !slotStartsAt ||
                    slotOptions.length === 0 ||
                    !specialistProfileIdForBooking
                  }
                >
                  {bookBusy ? '…' : 'Записать на приём'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <p style={{ color: 'var(--muted)' }}>Выберите клиента из поиска или создайте новую карточку.</p>
      )}
    </div>
  );
}
