
import { UserRole } from '@srs/shared-types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  OPENING_HOURS_UI_ORDER,
  OPENING_HOURS_WEEKDAY_LABEL,
  type DayOpeningDraft,
  defaultOpeningHoursDraft,
  mergeOpeningHoursWithDraft,
  openingHoursToDraft,
  validateOpeningHoursDraft,
} from '../../lib/opening-hours-form';
import { canMutateTenantCatalog } from '../../lib/roles';
import { DeleteIcon } from '../../ui/DeleteIcon';
import EditIcon from '../../ui/EditIcon';
import { FilterBar } from '../../ui/FilterBar';
import { useToast } from '../../ui/ToastContext';

import type { NetworkRow } from './network-types';
import type { FormEvent } from 'react';

interface StudioRow {
  id: string;
  networkId: string;
  name: string;
  address: string;
  city: string;
  timezone: string;
  phone: string | null;
  email: string | null;
  description: string | null;
  isActive: boolean;
  openingHours: unknown;
}

interface StudioFormState {
  networkId: string;
  name: string;
  address: string;
  city: string;
  timezone: string;
  phone: string;
  email: string;
  description: string;
  isActive: boolean;
  openingHoursDays: DayOpeningDraft[];
}

export function StudiosPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canMutate = user ? canMutateTenantCatalog(user.role) : false;
  const [searchParams, setSearchParams] = useSearchParams();

  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [rows, setRows] = useState<StudioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    mode: 'create' | 'edit';
    id?: string;
    form: StudioFormState;
    /** Сырое `openingHours` с сервера: при сохранении мержим, чтобы не терять лишние ключи в JSON. */
    openingHoursBaseline?: unknown;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const debouncedQuery = useDebouncedValue(searchQuery);

  const patchOpeningHoursDay = useCallback(
    (weekday: number, patch: Partial<Pick<DayOpeningDraft, 'closed' | 'open' | 'close'>>) => {
      setModal((m) => {
        if (!m) return m;
        return {
          ...m,
          form: {
            ...m.form,
            openingHoursDays: m.form.openingHoursDays.map((d) =>
              d.weekday === weekday ? { ...d, ...patch } : d,
            ),
          },
        };
      });
    },
    [],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studioData, netData] = await Promise.all([
        apiRequest<StudioRow[]>('/admin/catalog/studios'),
        apiRequest<NetworkRow[]>('/admin/catalog/networks'),
      ]);
      setRows(studioData);
      setNetworks(netData);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function openCreate() {
    const firstNet = networks[0]?.id ?? '';
    setModal({
      mode: 'create',
      form: {
        networkId: firstNet,
        name: '',
        address: '',
        city: '',
        timezone: 'Europe/Moscow',
        phone: '',
        email: '',
        description: '',
        isActive: true,
        openingHoursDays: defaultOpeningHoursDraft(),
      },
    });
  }

  function openEdit(row: StudioRow) {
    setModal({
      mode: 'edit',
      id: row.id,
      openingHoursBaseline: row.openingHours,
      form: {
        networkId: row.networkId,
        name: row.name,
        address: row.address,
        city: row.city,
        timezone: row.timezone,
        phone: row.phone ?? '',
        email: row.email ?? '',
        description: row.description ?? '',
        isActive: row.isActive,
        openingHoursDays: openingHoursToDraft(row.openingHours),
      },
    });
  }

  async function submitModal(ev: FormEvent) {
    ev.preventDefault();
    if (!modal) return;
    setSaving(true);
    setError(null);
    try {
      const hoursErr = validateOpeningHoursDraft(modal.form.openingHoursDays);
      if (hoursErr) {
        setError(hoursErr);
        setSaving(false);
        return;
      }
      const openingHours = mergeOpeningHoursWithDraft(
        modal.openingHoursBaseline,
        modal.form.openingHoursDays,
      );

      const common = {
        name: modal.form.name.trim(),
        address: modal.form.address.trim(),
        city: modal.form.city.trim(),
        timezone: modal.form.timezone.trim() || undefined,
        phone: modal.form.phone.trim() || undefined,
        email: modal.form.email.trim() || undefined,
        description: modal.form.description.trim() || undefined,
        isActive: modal.form.isActive,
        openingHours,
      };

      if (modal.mode === 'create') {
        await apiRequest('/admin/catalog/studios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            networkId: modal.form.networkId,
            ...common,
          }),
        });
      } else if (modal.id) {
        await apiRequest(`/admin/catalog/studios/${modal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            networkId: modal.form.networkId,
            ...common,
          }),
        });
      }
      setModal(null);
      await reload();
      showToast(modal.mode === 'create' ? 'Студия создана' : 'Студия обновлена', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
      showToast('Не удалось сохранить студию', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!globalThis.confirm(`Удалить студию «${name}»? Есть связанные данные — запрос может быть отклонён.`))
      return;
    setError(null);
    try {
      await apiRequest(`/admin/catalog/studios/${id}`, { method: 'DELETE' });
      await reload();
      showToast('Студия удалена', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
      showToast('Не удалось удалить студию', 'error');
    }
  }

  const netName = (id: string) => networks.find((n) => n.id === id)?.name ?? id.slice(0, 8);
  const filteredRows = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const networkLabel = networks.find((n) => n.id === r.networkId)?.name ?? r.networkId;
      return (
        r.name.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q) ||
        networkLabel.toLowerCase().includes(q)
      );
    });
  }, [rows, debouncedQuery, networks]);

  useEffect(() => {
    const next = new URLSearchParams();
    const q = searchQuery.trim();
    if (q) next.set('q', q);
    setSearchParams(next, { replace: true });
  }, [searchQuery, setSearchParams]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <h1 className="page-title" style={{ flex: 1 }}>
            Студии
          </h1>
          {canMutate ? (
            <button type="button" className="primary" onClick={() => openCreate()} disabled={networks.length === 0}>
              Новая студия
            </button>
          ) : null}
        </div>
        <p className="page-subtitle">
          Филиалы сети, которые видны клиенту при выборе локации и используются для расписаний специалистов.
        </p>
      </div>

      {networks.length === 0 && !loading ? (
        <div className="surface-card">
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            Сначала создайте хотя бы одну сеть на странице «Сети».
          </p>
        </div>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}

      <FilterBar
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onReset={() => setSearchQuery('')}
        resetDisabled={searchQuery.trim() === ''}
        foundCount={filteredRows.length}
        totalCount={rows.length}
        placeholder="Название, город, адрес или сеть"
      />

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Загрузка…</p>
      ) : (
        <div className="table-wrap sticky-head">
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Сеть</th>
                <th>Город</th>
                <th>Активна</th>
                {canMutate || user?.role === UserRole.StudioAdmin ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{netName(r.networkId)}</td>
                    <td>{r.city}</td>
                    <td>{r.isActive ? 'да' : 'нет'}</td>
                    {canMutate || user?.role === UserRole.StudioAdmin ? (
                      <td>
                        <span className="inline-actions">
                          <button
                            type="button"
                            className="action-icon-btn"
                            aria-label="Изменить студию"
                            title="Изменить"
                            onClick={() => openEdit(r)}
                          >
                            <EditIcon />
                          </button>
                          {canMutate ? (
                            <button
                              type="button"
                              className="danger action-icon-btn"
                              aria-label="Удалить студию"
                              title="Удалить"
                              onClick={() => void remove(r.id, r.name)}
                            >
                              <DeleteIcon />
                            </button>
                          ) : null}
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={canMutate || user?.role === UserRole.StudioAdmin ? 5 : 4}
                    style={{ color: 'var(--muted)' }}
                  >
                    Ничего не найдено. Попробуйте изменить запрос.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setModal(null)}>
          <div
            className="modal"
            style={{ width: 'min(720px, 100%)' }}
            role="dialog"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2>{modal.mode === 'create' ? 'Новая студия' : 'Редактирование студии'}</h2>
            <form onSubmit={(ev) => void submitModal(ev)}>
              <div className="field">
                <label htmlFor="st-net">Сеть</label>
                <select
                  id="st-net"
                  value={modal.form.networkId}
                  disabled={!canMutate && modal.mode === 'edit'}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, networkId: ev.target.value } })
                  }
                  required
                >
                  {networks.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.slug})
                    </option>
                  ))}
                </select>
                {!canMutate ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.35rem 0 0' }}>
                    StudioAdmin не может перенести студию в другую сеть.
                  </p>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="st-name">Название</label>
                <input
                  id="st-name"
                  value={modal.form.name}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, name: ev.target.value } })
                  }
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="st-address">Адрес</label>
                <input
                  id="st-address"
                  value={modal.form.address}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, address: ev.target.value } })
                  }
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="st-city">Город</label>
                <input
                  id="st-city"
                  value={modal.form.city}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, city: ev.target.value } })
                  }
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="st-tz">Часовой пояс</label>
                <input
                  id="st-tz"
                  className="mono"
                  value={modal.form.timezone}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, timezone: ev.target.value } })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="st-phone">Телефон</label>
                <input
                  id="st-phone"
                  value={modal.form.phone}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, phone: ev.target.value } })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="st-email">Email</label>
                <input
                  id="st-email"
                  type="email"
                  value={modal.form.email}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, email: ev.target.value } })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="st-desc">Описание</label>
                <textarea
                  id="st-desc"
                  rows={3}
                  value={modal.form.description}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, description: ev.target.value } })
                  }
                />
              </div>
              <div className="field">
                <label>
                  <input
                    type="checkbox"
                    checked={modal.form.isActive}
                    onChange={(ev) =>
                      setModal({ ...modal, form: { ...modal.form, isActive: ev.target.checked } })
                    }
                  />{' '}
                  Активна
                </label>
              </div>
              <div className="field">
                <p id="st-hours-label" style={{ fontWeight: 600, margin: '0 0 0.35rem' }}>
                  Часы работы
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 0.75rem' }}>
                  Укажите интервал приёма по местному времени студии (часовой пояс выше). Выходные
                  отметьте галочкой — в эти дни запись клиентов вне расписания будет недоступна.
                  Нужен хотя бы один рабочий день.
                </p>
                <div
                  role="group"
                  aria-labelledby="st-hours-label"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    padding: '0.75rem',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-weak)',
                  }}
                >
                  <div className="studio-opening-hours-grid-header">
                    <span>День</span>
                    <span />
                    <span>Открытие</span>
                    <span>Закрытие</span>
                  </div>
                  {OPENING_HOURS_UI_ORDER.map((weekday) => {
                    const day = modal.form.openingHoursDays.find((d) => d.weekday === weekday);
                    if (!day) return null;
                    const label = OPENING_HOURS_WEEKDAY_LABEL[weekday];
                    return (
                      <div key={weekday} className="studio-opening-hours-grid-row">
                        <span style={{ fontWeight: 500 }}>{label}</span>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={day.closed}
                            onChange={(ev) => patchOpeningHoursDay(weekday, { closed: ev.target.checked })}
                          />
                          Выходной
                        </label>
                        <div className="field" style={{ margin: 0 }}>
                          <input
                            type="time"
                            aria-label={`${label}: открытие`}
                            value={day.open}
                            disabled={day.closed}
                            onChange={(ev) => patchOpeningHoursDay(weekday, { open: ev.target.value })}
                          />
                        </div>
                        <div className="field" style={{ margin: 0 }}>
                          <input
                            type="time"
                            aria-label={`${label}: закрытие`}
                            value={day.close}
                            disabled={day.closed}
                            onChange={(ev) => patchOpeningHoursDay(weekday, { close: ev.target.value })}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setModal(null)}>
                  Отмена
                </button>
                <button type="submit" className="primary" disabled={saving}>
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
