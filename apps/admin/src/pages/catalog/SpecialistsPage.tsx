import { UserRole } from '@podocare/shared-types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { canManageStaff, canMutateTenantCatalog } from '../../lib/roles';

import type { FormEvent } from 'react';

interface StudioRow {
  id: string;
  networkId: string;
  name: string;
  city: string;
}

interface SpecialistRow {
  id: string;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  primaryStudioId: string | null;
  isActive: boolean;
  createdAt: string;
  specialistProfile: {
    specializations: string[];
    studios: { id: string; name: string; city: string }[];
  };
}

interface SpecialistFormState {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
  middleName: string;
  specializationsText: string;
  selectedStudioIds: string[];
  primaryStudioId: string;
  isActive: boolean;
}

function toggleStudioId(ids: string[], studioId: string, on: boolean): string[] {
  const set = new Set(ids);
  if (on) {
    set.add(studioId);
  } else {
    set.delete(studioId);
  }
  return [...set];
}

export function SpecialistsPage() {
  const { user } = useAuth();
  const manage = user ? canManageStaff(user.role) : false;
  const canFilterByStudio = user ? canMutateTenantCatalog(user.role) : false;
  const studioAdmin = user?.role === UserRole.StudioAdmin;

  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [rows, setRows] = useState<SpecialistRow[]>([]);
  const [studioFilterId, setStudioFilterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    mode: 'create' | 'edit';
    id?: string;
    form: SpecialistFormState;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studioData, list] = await Promise.all([
        apiRequest<StudioRow[]>('/admin/catalog/studios'),
        (() => {
          const q =
            canFilterByStudio && studioFilterId.trim() !== ''
              ? `?studioId=${encodeURIComponent(studioFilterId.trim())}`
              : '';
          return apiRequest<SpecialistRow[]>(`/admin/catalog/specialists${q}`);
        })(),
      ]);
      setStudios(studioData);
      setRows(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [canFilterByStudio, studioFilterId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const defaultSelectedStudios = useMemo(() => {
    if (studioAdmin && studios.length > 0) {
      return [studios[0]!.id];
    }
    return [];
  }, [studioAdmin, studios]);

  function defaultForm(): SpecialistFormState {
    const sel = defaultSelectedStudios;
    return {
      email: '',
      password: '',
      phone: '',
      firstName: '',
      lastName: '',
      middleName: '',
      specializationsText: '',
      selectedStudioIds: sel,
      primaryStudioId: sel[0] ?? '',
      isActive: true,
    };
  }

  function openCreate() {
    setModal({ mode: 'create', form: defaultForm() });
  }

  function openEdit(row: SpecialistRow) {
    const sel = row.specialistProfile.studios.map((s) => s.id);
    const primary = row.primaryStudioId ?? sel[0] ?? '';
    setModal({
      mode: 'edit',
      id: row.id,
      form: {
        email: row.email ?? '',
        password: '',
        phone: row.phone,
        firstName: row.firstName,
        lastName: row.lastName,
        middleName: row.middleName ?? '',
        specializationsText: row.specialistProfile.specializations.join(', '),
        selectedStudioIds: sel.length > 0 ? sel : defaultSelectedStudios,
        primaryStudioId: primary,
        isActive: row.isActive,
      },
    });
  }

  function setFormStudios(
    m: NonNullable<typeof modal>,
    nextIds: string[],
  ): NonNullable<typeof modal> {
    let primary = m.form.primaryStudioId;
    if (!nextIds.includes(primary)) {
      primary = nextIds[0] ?? '';
    }
    return { ...m, form: { ...m.form, selectedStudioIds: nextIds, primaryStudioId: primary } };
  }

  async function submitModal(ev: FormEvent) {
    ev.preventDefault();
    if (!modal || !user) return;

    const studioIds = modal.form.selectedStudioIds;
    if (studioIds.length === 0) {
      setError('Выберите хотя бы одну студию');
      return;
    }
    if (!modal.form.primaryStudioId || !studioIds.includes(modal.form.primaryStudioId)) {
      setError('Укажите основную студию из отмеченных');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const mid = modal.form.middleName.trim();
      const specs = modal.form.specializationsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (modal.mode === 'create') {
        if (modal.form.password.length < 8) {
          setError('Пароль не короче 8 символов');
          setSaving(false);
          return;
        }
        await apiRequest('/admin/catalog/specialists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: modal.form.email.trim(),
            password: modal.form.password,
            phone: modal.form.phone.trim(),
            firstName: modal.form.firstName.trim(),
            lastName: modal.form.lastName.trim(),
            ...(mid ? { middleName: mid } : {}),
            studioIds,
            primaryStudioId: modal.form.primaryStudioId,
            ...(specs.length > 0 ? { specializations: specs } : {}),
          }),
        });
      } else if (modal.id) {
        const patch: {
          email: string;
          phone: string;
          firstName: string;
          lastName: string;
          middleName: string | null;
          studioIds: string[];
          primaryStudioId: string;
          specializations: string[];
          isActive: boolean;
          password?: string;
        } = {
          email: modal.form.email.trim(),
          phone: modal.form.phone.trim(),
          firstName: modal.form.firstName.trim(),
          lastName: modal.form.lastName.trim(),
          middleName: mid === '' ? null : mid,
          studioIds,
          primaryStudioId: modal.form.primaryStudioId,
          specializations: specs,
          isActive: modal.form.isActive,
        };
        if (modal.form.password.trim() !== '') {
          if (modal.form.password.length < 8) {
            setError('Пароль не короче 8 символов');
            setSaving(false);
            return;
          }
          patch.password = modal.form.password;
        }
        await apiRequest(`/admin/catalog/specialists/${modal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
      }
      setModal(null);
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row: SpecialistRow) {
    if (
      !globalThis.confirm(
        `Деактивировать специалиста «${row.lastName} ${row.firstName}»? Вход в систему будет отключён.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await apiRequest(`/admin/catalog/specialists/${row.id}`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
    }
  }

  const studiosLabel = (r: SpecialistRow) =>
    r.specialistProfile.studios.map((s) => `${s.name} (${s.city})`).join(', ') || '—';

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0, flex: 1 }}>Специалисты</h1>
        {manage ? (
          <button
            type="button"
            className="primary"
            onClick={() => openCreate()}
            disabled={!studioAdmin && studios.length === 0}
          >
            Добавить
          </button>
        ) : null}
      </div>

      <p style={{ color: 'var(--muted)', marginTop: 0, fontSize: '0.9rem' }}>
        Подологи, остеопаты, массажисты и др. Отметьте, в каких студиях сети ведётся приём; основная студия
        задаёт привязку учётной записи.
      </p>

      {canFilterByStudio ? (
        <div className="field" style={{ maxWidth: 420, marginBottom: '1rem' }}>
          <label htmlFor="spec-filter-studio">Фильтр по студии</label>
          <select
            id="spec-filter-studio"
            value={studioFilterId}
            onChange={(ev) => setStudioFilterId(ev.target.value)}
          >
            <option value="">Все</option>
            {studios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.city})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!studioAdmin && studios.length === 0 && !loading ? (
        <p style={{ color: 'var(--muted)' }}>Сначала создайте студию на странице «Студии».</p>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Загрузка…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Студии</th>
                <th>Специализации</th>
                <th>Email</th>
                <th>Телефон</th>
                <th>Активен</th>
                {manage ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.lastName} {r.firstName}
                    {r.middleName ? ` ${r.middleName}` : ''}
                  </td>
                  <td style={{ maxWidth: 280 }}>{studiosLabel(r)}</td>
                  <td>
                    {r.specialistProfile.specializations.length > 0
                      ? r.specialistProfile.specializations.join(', ')
                      : '—'}
                  </td>
                  <td>{r.email ?? '—'}</td>
                  <td className="mono">{r.phone}</td>
                  <td>{r.isActive ? 'да' : 'нет'}</td>
                  {manage ? (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" onClick={() => openEdit(r)}>
                        Изменить
                      </button>{' '}
                      <button
                        type="button"
                        className="danger"
                        onClick={() => void removeRow(r)}
                        disabled={r.id === user?.id}
                      >
                        Деактивировать
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setModal(null)}>
          <div
            className="modal"
            style={{ width: 'min(560px, 100%)' }}
            role="dialog"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2>{modal.mode === 'create' ? 'Новый специалист' : 'Редактирование'}</h2>
            <form onSubmit={(ev) => void submitModal(ev)}>
              <div className="field">
                <span>Студии</span>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    marginTop: '0.35rem',
                    maxHeight: 200,
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '0.5rem 0.75rem',
                  }}
                >
                  {studios.map((s) => {
                    const checked = modal.form.selectedStudioIds.includes(s.id);
                    return (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={studioAdmin}
                          onChange={(ev) =>
                            setModal(
                              setFormStudios(
                                modal,
                                toggleStudioId(modal.form.selectedStudioIds, s.id, ev.target.checked),
                              ),
                            )
                          }
                        />
                        {s.name} ({s.city})
                      </label>
                    );
                  })}
                </div>
                {studioAdmin ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.35rem 0 0' }}>
                    Администратор студии может добавлять специалистов только в свою точку.
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="spec-primary">Основная студия</label>
                <select
                  id="spec-primary"
                  value={modal.form.primaryStudioId}
                  onChange={(ev) =>
                    setModal({
                      ...modal,
                      form: { ...modal.form, primaryStudioId: ev.target.value },
                    })
                  }
                  required
                >
                  {modal.form.selectedStudioIds.length === 0 ? (
                    <option value="">— сначала выберите студии —</option>
                  ) : null}
                  {studios
                    .filter((s) => modal.form.selectedStudioIds.includes(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.city})
                      </option>
                    ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="spec-specs">Специализации (через запятую)</label>
                <input
                  id="spec-specs"
                  placeholder="Подолог, остеопат, массажист…"
                  value={modal.form.specializationsText}
                  onChange={(ev) =>
                    setModal({
                      ...modal,
                      form: { ...modal.form, specializationsText: ev.target.value },
                    })
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="spec-email">Email (вход в админку)</label>
                <input
                  id="spec-email"
                  type="email"
                  autoComplete="email"
                  value={modal.form.email}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, email: ev.target.value } })
                  }
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="spec-pass">
                  Пароль {modal.mode === 'edit' ? '(оставьте пустым, чтобы не менять)' : ''}
                </label>
                <input
                  id="spec-pass"
                  type="password"
                  autoComplete={modal.mode === 'create' ? 'new-password' : 'current-password'}
                  value={modal.form.password}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, password: ev.target.value } })
                  }
                  required={modal.mode === 'create'}
                  minLength={modal.mode === 'create' ? 8 : undefined}
                />
              </div>

              <div className="field">
                <label htmlFor="spec-phone">Телефон</label>
                <input
                  id="spec-phone"
                  className="mono"
                  value={modal.form.phone}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, phone: ev.target.value } })
                  }
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="spec-ln">Фамилия</label>
                <input
                  id="spec-ln"
                  value={modal.form.lastName}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, lastName: ev.target.value } })
                  }
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="spec-fn">Имя</label>
                <input
                  id="spec-fn"
                  value={modal.form.firstName}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, firstName: ev.target.value } })
                  }
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="spec-mn">Отчество</label>
                <input
                  id="spec-mn"
                  value={modal.form.middleName}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, middleName: ev.target.value } })
                  }
                />
              </div>

              {modal.mode === 'edit' ? (
                <div className="field">
                  <label>
                    <input
                      type="checkbox"
                      checked={modal.form.isActive}
                      onChange={(ev) =>
                        setModal({
                          ...modal,
                          form: { ...modal.form, isActive: ev.target.checked },
                        })
                      }
                      disabled={modal.id === user?.id}
                    />{' '}
                    Активен
                  </label>
                </div>
              ) : null}

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
