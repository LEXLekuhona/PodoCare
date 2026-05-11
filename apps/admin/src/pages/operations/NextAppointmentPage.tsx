import { AppointmentSource } from '@srs/shared-types';
import { useCallback, useEffect, useState } from 'react';

import { formatRub } from './clinical-shared';
import { ClinicalVisitPickerFields } from './ClinicalVisitPickerFields';
import { useClinicalVisitPicker } from './useClinicalVisitPicker';
import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { canUseClinicalOperations } from '../../lib/roles';

import type { BookingSlotOption, VisitSaleCatalog } from './clinical-shared';


export function NextAppointmentPage() {
  const { user } = useAuth();
  const allowed = user ? canUseClinicalOperations(user.role) : false;
  const {
    studios,
    studioId,
    setStudioId,
    appointments,
    selectedAppointmentId,
    setSelectedAppointmentId,
    selectedAppointment,
    loading,
    loadAppointments,
    error,
    setError,
  } = useClinicalVisitPicker();

  const [notice, setNotice] = useState<string | null>(null);
  const [visitCatalog, setVisitCatalog] = useState<VisitSaleCatalog | null>(null);
  const [nextServiceId, setNextServiceId] = useState('');
  const [nextSlotOptions, setNextSlotOptions] = useState<BookingSlotOption[]>([]);
  const [nextSlotStartsAt, setNextSlotStartsAt] = useState('');
  const [loadingNextSlots, setLoadingNextSlots] = useState(false);
  const [savingNextBooking, setSavingNextBooking] = useState(false);

  useEffect(() => {
    if (!allowed || !selectedAppointment?.studioId) {
      setVisitCatalog(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const catalog = await apiRequest<VisitSaleCatalog>(
          `/orders/visit-sale-catalog?studioId=${encodeURIComponent(selectedAppointment.studioId)}`,
        );
        if (cancelled) return;
        setVisitCatalog(catalog);
      } catch (e) {
        if (cancelled) return;
        setVisitCatalog(null);
        if (e instanceof ApiError) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, selectedAppointment?.id, selectedAppointment?.studioId, setError]);

  useEffect(() => {
    if (!visitCatalog?.services.length) {
      setNextServiceId('');
      return;
    }
    const fromAppt = selectedAppointment?.serviceId;
    if (fromAppt && visitCatalog.services.some((s) => s.id === fromAppt)) {
      setNextServiceId(fromAppt);
    } else {
      setNextServiceId(visitCatalog.services[0]!.id);
    }
  }, [visitCatalog, selectedAppointment?.serviceId]);

  const loadNextSlots = useCallback(async () => {
    if (!selectedAppointment || !nextServiceId.trim()) {
      setNextSlotOptions([]);
      setNextSlotStartsAt('');
      return;
    }
    setLoadingNextSlots(true);
    try {
      const q = new URLSearchParams({
        studioId: selectedAppointment.studioId,
        specialistId: selectedAppointment.specialistId,
        serviceId: nextServiceId.trim(),
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
      setNextSlotOptions(options);
      setNextSlotStartsAt(options[0]?.startsAt ?? '');
    } catch (e) {
      setNextSlotOptions([]);
      setNextSlotStartsAt('');
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setLoadingNextSlots(false);
    }
  }, [selectedAppointment, nextServiceId, setError]);

  useEffect(() => {
    if (!allowed || (!selectedAppointment?.clientUserId && !selectedAppointment?.walkInClientId)) {
      setNextSlotOptions([]);
      setNextSlotStartsAt('');
      return;
    }
    void loadNextSlots();
  }, [
    allowed,
    selectedAppointment?.id,
    selectedAppointment?.clientUserId,
    selectedAppointment?.walkInClientId,
    loadNextSlots,
  ]);

  async function submitNextBooking() {
    if (
      (!selectedAppointment?.clientUserId && !selectedAppointment?.walkInClientId) ||
      !nextSlotStartsAt.trim() ||
      !nextServiceId.trim()
    )
      return;
    setSavingNextBooking(true);
    setError(null);
    setNotice(null);
    try {
      const body: Record<string, unknown> = {
        studioId: selectedAppointment.studioId,
        specialistId: selectedAppointment.specialistId,
        serviceId: nextServiceId.trim(),
        startsAt: nextSlotStartsAt,
        source: AppointmentSource.Studio,
        specialistNote: 'Запись из раздела «Следующий приём»',
      };
      if (selectedAppointment.clientUserId) {
        body['clientUserId'] = selectedAppointment.clientUserId;
      } else if (selectedAppointment.walkInClientId) {
        body['walkInClientId'] = selectedAppointment.walkInClientId;
      }
      await apiRequest(`/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setNotice('Клиент записан на следующий приём');
      await loadAppointments();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось создать запись');
    } finally {
      setSavingNextBooking(false);
    }
  }

  if (!allowed) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <h1 className="page-title">Следующий приём</h1>
          <p className="page-subtitle">Недостаточно прав.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Следующий приём</h1>
        <p className="page-subtitle">
          Новая запись для того же клиента (приложение или walk-in) к тому же специалисту в этой студии. Учитываются
          смены и занятость.
        </p>
      </div>

      <ClinicalVisitPickerFields
        studios={studios}
        studioId={studioId}
        onStudioIdChange={setStudioId}
        appointments={appointments}
        selectedAppointmentId={selectedAppointmentId}
        onAppointmentIdChange={setSelectedAppointmentId}
        loading={loading}
        ids={{ studio: 'na-studio', appointment: 'na-appointment' }}
      />

      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? <div className="success-banner">{notice}</div> : null}

      {!selectedAppointment ? (
        <p style={{ color: 'var(--muted)' }}>
          {loading ? 'Загрузка визитов…' : 'Нет записей с клиентом (приложение или без приложения).'}
        </p>
      ) : (
        <div className="surface-card">
          {!visitCatalog?.services.length ? (
            <p style={{ color: 'var(--muted)' }}>
              {visitCatalog ? 'Нет услуг в каталоге студии.' : 'Загрузка каталога…'}
            </p>
          ) : (
            <>
              <div className="field" style={{ maxWidth: 480 }}>
                <label htmlFor="na-next-svc">Услуга</label>
                <select id="na-next-svc" value={nextServiceId} onChange={(ev) => setNextServiceId(ev.target.value)}>
                  {visitCatalog.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.durationMinutes} мин, {formatRub(s.priceMinor)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ maxWidth: 480 }}>
                <label htmlFor="na-next-slot">Дата и время</label>
                <select
                  id="na-next-slot"
                  value={nextSlotStartsAt}
                  onChange={(ev) => setNextSlotStartsAt(ev.target.value)}
                  disabled={loadingNextSlots || nextSlotOptions.length === 0}
                >
                  {nextSlotOptions.length === 0 ? (
                    <option value="">{loadingNextSlots ? 'Загрузка слотов…' : 'Нет свободных слотов'}</option>
                  ) : (
                    nextSlotOptions.map((opt) => (
                      <option key={opt.startsAt} value={opt.startsAt}>
                        {opt.dateLabel} {opt.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="toolbar" style={{ marginBottom: 0 }}>
                <button type="button" onClick={() => void loadNextSlots()} disabled={loadingNextSlots}>
                  Обновить слоты
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => void submitNextBooking()}
                  disabled={savingNextBooking || !nextSlotStartsAt || nextSlotOptions.length === 0}
                >
                  {savingNextBooking ? '…' : 'Записать клиента'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
