import { useEffect, useState } from 'react';

import { formatRub, orderStatusRu } from './clinical-shared';
import { ClinicalVisitPickerFields } from './ClinicalVisitPickerFields';
import { useClinicalVisitPicker } from './useClinicalVisitPicker';
import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { canUseClinicalOperations } from '../../lib/roles';

import type { InvoiceDraftLine, VisitOrderRow, VisitSaleCatalog } from './clinical-shared';


export function VisitPaymentPage() {
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
    error,
    setError,
  } = useClinicalVisitPicker();

  const [notice, setNotice] = useState<string | null>(null);
  const [visitCatalog, setVisitCatalog] = useState<VisitSaleCatalog | null>(null);
  const [visitOrder, setVisitOrder] = useState<VisitOrderRow | null>(null);
  const [invoiceDraftLines, setInvoiceDraftLines] = useState<InvoiceDraftLine[]>([]);
  const [invoiceDraftType, setInvoiceDraftType] = useState<'SERVICE' | 'PHYSICAL_GOOD'>('SERVICE');
  const [invoiceDraftRefId, setInvoiceDraftRefId] = useState('');
  const [invoiceDraftQty, setInvoiceDraftQty] = useState(1);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [recordingCash, setRecordingCash] = useState(false);
  const [initingCard, setInitingCard] = useState(false);
  const [tinkoffPayUrl, setTinkoffPayUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed || !selectedAppointment?.studioId) {
      setVisitCatalog(null);
      setVisitOrder(null);
      setInvoiceDraftLines([]);
      setTinkoffPayUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [catalog, wrap] = await Promise.all([
          apiRequest<VisitSaleCatalog>(
            `/orders/visit-sale-catalog?studioId=${encodeURIComponent(selectedAppointment.studioId)}`,
          ),
          apiRequest<{ order: VisitOrderRow | null }>(
            `/orders/visit-invoice/by-appointment/${selectedAppointment.id}`,
          ),
        ]);
        if (cancelled) return;
        setVisitCatalog(catalog);
        setVisitOrder(wrap.order);
        setInvoiceDraftLines([]);
        setTinkoffPayUrl(null);
      } catch (e) {
        if (cancelled) return;
        setVisitCatalog(null);
        setVisitOrder(null);
        if (e instanceof ApiError) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, selectedAppointment?.id, selectedAppointment?.studioId, setError]);

  async function refreshVisitOrder() {
    if (!selectedAppointment) return;
    try {
      const wrap = await apiRequest<{ order: VisitOrderRow | null }>(
        `/orders/visit-invoice/by-appointment/${selectedAppointment.id}`,
      );
      setVisitOrder(wrap.order);
    } catch {
      /* ignore */
    }
  }

  function addInvoiceDraftLine() {
    if (!invoiceDraftRefId.trim() || invoiceDraftQty < 1) return;
    setInvoiceDraftLines((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        productType: invoiceDraftType,
        refId: invoiceDraftRefId.trim(),
        quantity: invoiceDraftQty,
      },
    ]);
  }

  function removeInvoiceDraftLine(key: string) {
    setInvoiceDraftLines((prev) => prev.filter((line) => line.key !== key));
  }

  async function submitVisitInvoice() {
    if (
      (!selectedAppointment?.clientUserId && !selectedAppointment?.walkInClientId) ||
      invoiceDraftLines.length === 0
    )
      return;
    setSavingInvoice(true);
    setError(null);
    setNotice(null);
    try {
      const items = invoiceDraftLines.map((line) =>
        line.productType === 'SERVICE'
          ? { productType: 'SERVICE' as const, serviceId: line.refId, quantity: line.quantity }
          : { productType: 'PHYSICAL_GOOD' as const, physicalGoodId: line.refId, quantity: line.quantity },
      );
      const created = await apiRequest<VisitOrderRow>(`/orders/visit-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: selectedAppointment.id,
          items,
        }),
      });
      setVisitOrder(created);
      setInvoiceDraftLines([]);
      setNotice('Счёт выставлен клиенту');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        await refreshVisitOrder();
        setNotice('По этому визиту уже есть счёт — загружен текущий');
      } else {
        setError(e instanceof ApiError ? e.message : 'Не удалось выставить счёт');
      }
    } finally {
      setSavingInvoice(false);
    }
  }

  async function submitVisitCash() {
    if (!visitOrder) return;
    setRecordingCash(true);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(`/orders/${visitOrder.id}/visit-payments/cash`, { method: 'POST' });
      setNotice('Оплата наличными отмечена');
      await refreshVisitOrder();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось провести оплату');
    } finally {
      setRecordingCash(false);
    }
  }

  async function submitVisitTinkoff() {
    if (!visitOrder) return;
    setInitingCard(true);
    setError(null);
    setNotice(null);
    setTinkoffPayUrl(null);
    try {
      const pay = await apiRequest<{ confirmationUrl?: string | null }>(
        `/orders/${visitOrder.id}/visit-payments/tinkoff-init`,
        { method: 'POST' },
      );
      const url = pay?.confirmationUrl ?? null;
      setTinkoffPayUrl(url);
      if (url) {
        setNotice('Откройте ссылку для оплаты картой');
      } else {
        setNotice('Запрос к эквайрингу отправлен');
      }
      await refreshVisitOrder();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось инициировать оплату картой');
    } finally {
      setInitingCard(false);
    }
  }

  if (!allowed) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <h1 className="page-title">Оплата после приёма</h1>
          <p className="page-subtitle">Недостаточно прав.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Оплата после приёма</h1>
        <p className="page-subtitle">
          Счёт привязан к визиту: клиент из приложения или walk-in (без приложения). Наличные или ссылка Тинькофф.
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
        ids={{ studio: 'vp-studio', appointment: 'vp-appointment' }}
      />

      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? <div className="success-banner">{notice}</div> : null}

      {!selectedAppointment ? (
        <p style={{ color: 'var(--muted)' }}>
          {loading ? 'Загрузка визитов…' : 'Нет записей с клиентом (приложение или без приложения).'}
        </p>
      ) : (
        <div className="surface-card">
          {!visitCatalog ? (
            <p style={{ color: 'var(--muted)' }}>Загрузка каталога…</p>
          ) : visitOrder ? (
            <div>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>Счёт {visitOrder.orderNumber}</strong> — {orderStatusRu(visitOrder.status)} · итого{' '}
                {formatRub(visitOrder.totalMinor)}
              </p>
              <ul style={{ margin: '0 0 0.75rem', paddingLeft: '1.2rem' }}>
                {visitOrder.items.map((item) => (
                  <li key={item.id}>
                    {item.nameSnapshot} × {item.quantity} — {formatRub(item.totalMinor)}
                  </li>
                ))}
              </ul>
              {visitOrder.status === 'PAID' || visitOrder.status === 'COMPLETED' ? (
                <p style={{ color: 'var(--muted)' }}>Оплата по этому счёту получена.</p>
              ) : (
                <div className="toolbar" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => void submitVisitCash()}
                    disabled={recordingCash}
                  >
                    {recordingCash ? '…' : 'Оплата наличными'}
                  </button>
                  <button type="button" onClick={() => void submitVisitTinkoff()} disabled={initingCard}>
                    {initingCard ? '…' : 'Ссылка на оплату картой'}
                  </button>
                </div>
              )}
              {tinkoffPayUrl ? (
                <p style={{ marginTop: '0.75rem' }}>
                  <a href={tinkoffPayUrl} target="_blank" rel="noreferrer">
                    Открыть страницу оплаты
                  </a>
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="grid two-col">
                <div className="field">
                  <label htmlFor="vp-inv-type">Тип позиции</label>
                  <select
                    id="vp-inv-type"
                    value={invoiceDraftType}
                    onChange={(ev) => {
                      setInvoiceDraftType(ev.target.value as 'SERVICE' | 'PHYSICAL_GOOD');
                      setInvoiceDraftRefId('');
                    }}
                  >
                    <option value="SERVICE">Услуга</option>
                    <option value="PHYSICAL_GOOD">Товар</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="vp-inv-qty">Количество</label>
                  <input
                    id="vp-inv-qty"
                    type="number"
                    min={1}
                    value={invoiceDraftQty}
                    onChange={(ev) => setInvoiceDraftQty(Math.max(1, Number(ev.target.value) || 1))}
                  />
                </div>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="vp-inv-item">{invoiceDraftType === 'SERVICE' ? 'Услуга' : 'Товар'}</label>
                  <select
                    id="vp-inv-item"
                    value={invoiceDraftRefId}
                    onChange={(ev) => setInvoiceDraftRefId(ev.target.value)}
                  >
                    <option value="">— выберите —</option>
                    {(invoiceDraftType === 'SERVICE' ? visitCatalog.services : visitCatalog.physicalGoods).map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name} ({formatRub(row.priceMinor)}
                        {invoiceDraftType === 'PHYSICAL_GOOD' && 'stock' in row && row.stock != null
                          ? `, ост. ${row.stock}`
                          : ''}
                        )
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="toolbar">
                <button type="button" onClick={addInvoiceDraftLine}>
                  Добавить в счёт
                </button>
              </div>
              {invoiceDraftLines.length > 0 ? (
                <ul style={{ margin: '0.75rem 0', paddingLeft: '1.2rem' }}>
                  {invoiceDraftLines.map((line) => {
                    const cat = visitCatalog;
                    const label =
                      line.productType === 'SERVICE'
                        ? cat.services.find((s) => s.id === line.refId)?.name ?? line.refId
                        : cat.physicalGoods.find((g) => g.id === line.refId)?.name ?? line.refId;
                    return (
                      <li key={line.key}>
                        {label} × {line.quantity}
                        <button
                          type="button"
                          style={{ marginLeft: '0.5rem' }}
                          onClick={() => removeInvoiceDraftLine(line.key)}
                        >
                          Убрать
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              <div className="toolbar" style={{ marginBottom: 0 }}>
                <button
                  type="button"
                  className="primary"
                  onClick={() => void submitVisitInvoice()}
                  disabled={savingInvoice || invoiceDraftLines.length === 0}
                >
                  {savingInvoice ? '…' : 'Выставить счёт'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
