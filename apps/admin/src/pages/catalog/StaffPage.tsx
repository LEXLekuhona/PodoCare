import { UserRole } from '@srs/shared-types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { canManageStaff, canMutateTenantCatalog } from '../../lib/roles';
import { DeleteIcon } from '../../ui/DeleteIcon';
import EditIcon from '../../ui/EditIcon';
import { FilterBar } from '../../ui/FilterBar';
import { useToast } from '../../ui/ToastContext';

import type { FormEvent } from 'react';

interface StudioRow {
  id: string;
  networkId: string;
  name: string;
  city: string;
}

interface StaffRow {
  id: string;
  role: UserRole;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  studioId: string | null;
  isActive: boolean;
  createdAt: string;
  studio: { id: string; name: string; city: string } | null;
}

interface StaffFormState {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
  middleName: string;
  role: UserRole;
  studioId: string;
  isActive: boolean;
}

function roleLabelRu(role: UserRole): string {
  switch (role) {
    case UserRole.StudioAdmin:
      return 'Админ студии';
    case UserRole.NetworkOwner:
      return 'Владелец сети';
    case UserRole.ContentAuthor:
      return 'Автор контента';
    case UserRole.SuperAdmin:
      return 'SuperAdmin';
    case UserRole.Client:
      return 'Клиент';
    default:
      return role;
  }
}

/** Роли, доступные для создания в этом разделе (без специалистов — см. «Специалисты»). */
function assignableRoles(actorRole: UserRole): UserRole[] {
  switch (actorRole) {
    case UserRole.StudioAdmin:
      return [UserRole.StudioAdmin];
    case UserRole.NetworkOwner:
      return [UserRole.StudioAdmin, UserRole.ContentAuthor];
    case UserRole.SuperAdmin:
      return [UserRole.StudioAdmin, UserRole.ContentAuthor, UserRole.NetworkOwner];
    default:
      return [];
  }
}

function roleNeedsStudio(role: UserRole): boolean {
  return role === UserRole.StudioAdmin;
}

export function StaffPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const manage = user ? canManageStaff(user.role) : false;
  const canFilterByStudio = user ? canMutateTenantCatalog(user.role) : false;
  const [searchParams, setSearchParams] = useSearchParams();

  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [studioFilterId, setStudioFilterId] = useState(() => searchParams.get('studio') ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    mode: 'create' | 'edit';
    id?: string;
    form: StaffFormState;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const debouncedQuery = useDebouncedValue(searchQuery);

  const rolesForActor = useMemo(
    () => (user ? assignableRoles(user.role) : []),
    [user],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studioData, staffPath] = await Promise.all([
        apiRequest<StudioRow[]>('/admin/catalog/studios'),
        (() => {
          const q =
            canFilterByStudio && studioFilterId.trim() !== ''
              ? `?studioId=${encodeURIComponent(studioFilterId.trim())}`
              : '';
          return apiRequest<StaffRow[]>(`/admin/catalog/staff${q}`);
        })(),
      ]);
      setStudios(studioData);
      setRows(staffPath);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [canFilterByStudio, studioFilterId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function defaultForm(): StaffFormState {
    const firstStudio = studios[0]?.id ?? '';
    const defaultRole = rolesForActor[0] ?? UserRole.StudioAdmin;
    return {
      email: '',
      password: '',
      phone: '',
      firstName: '',
      lastName: '',
      middleName: '',
      role: defaultRole,
      studioId: firstStudio,
      isActive: true,
    };
  }

  function openCreate() {
    setModal({ mode: 'create', form: defaultForm() });
  }

  function openEdit(row: StaffRow) {
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
        role: row.role,
        studioId: row.studioId ?? studios[0]?.id ?? '',
        isActive: row.isActive,
      },
    });
  }

  async function submitModal(ev: FormEvent) {
    ev.preventDefault();
    if (!modal || !user) return;

    setSaving(true);
    setError(null);
    try {
      if (modal.mode === 'create') {
        if (modal.form.password.length < 8) {
          setError('Пароль не короче 8 символов');
          setSaving(false);
          return;
        }
        const mid = modal.form.middleName.trim();
        await apiRequest('/admin/catalog/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: modal.form.email.trim(),
            password: modal.form.password,
            phone: modal.form.phone.trim(),
            firstName: modal.form.firstName.trim(),
            lastName: modal.form.lastName.trim(),
            role: modal.form.role,
            ...(mid ? { middleName: mid } : {}),
            ...(roleNeedsStudio(modal.form.role) && user.role !== UserRole.StudioAdmin
              ? { studioId: modal.form.studioId }
              : {}),
          }),
        });
      } else if (modal.id) {
        const mid = modal.form.middleName.trim();
        const patch: {
          email: string;
          phone: string;
          firstName: string;
          lastName: string;
          role: UserRole;
          isActive: boolean;
          middleName: string | null;
          password?: string;
          studioId?: string | null;
        } = {
          email: modal.form.email.trim(),
          phone: modal.form.phone.trim(),
          firstName: modal.form.firstName.trim(),
          lastName: modal.form.lastName.trim(),
          role: modal.form.role,
          isActive: modal.form.isActive,
          middleName: mid === '' ? null : mid,
        };
        if (modal.form.password.trim() !== '') {
          if (modal.form.password.length < 8) {
            setError('Пароль не короче 8 символов');
            setSaving(false);
            return;
          }
          patch.password = modal.form.password;
        }
        if (roleNeedsStudio(modal.form.role) && user.role !== UserRole.StudioAdmin) {
          patch.studioId = modal.form.studioId;
        } else if (!roleNeedsStudio(modal.form.role)) {
          patch.studioId = null;
        }
        await apiRequest(`/admin/catalog/staff/${modal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
      }
      setModal(null);
      await reload();
      showToast(modal.mode === 'create' ? 'Сотрудник создан' : 'Сотрудник обновлён', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
      showToast('Не удалось сохранить сотрудника', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row: StaffRow) {
    if (
      !globalThis.confirm(
        `Деактивировать сотрудника «${row.lastName} ${row.firstName}»? Вход в систему будет отключён.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await apiRequest(`/admin/catalog/staff/${row.id}`, { method: 'DELETE' });
      await reload();
      showToast('Сотрудник деактивирован', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
      showToast('Не удалось деактивировать сотрудника', 'error');
    }
  }

  const studioLabel = (r: StaffRow) =>
    r.studio ? `${r.studio.name}, ${r.studio.city}` : '—';
  const filteredRows = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const fullName = `${r.lastName} ${r.firstName} ${r.middleName ?? ''}`;
      const studio = r.studio ? `${r.studio.name}, ${r.studio.city}` : '—';
      return (
        fullName.toLowerCase().includes(q) ||
        roleLabelRu(r.role).toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        studio.toLowerCase().includes(q)
      );
    });
  }, [rows, debouncedQuery]);

  useEffect(() => {
    const next = new URLSearchParams();
    const q = searchQuery.trim();
    const studio = studioFilterId.trim();
    if (q) next.set('q', q);
    if (studio) next.set('studio', studio);
    setSearchParams(next, { replace: true });
  }, [searchQuery, studioFilterId, setSearchParams]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <h1 className="page-title" style={{ flex: 1 }}>
            Сотрудники
          </h1>
          {manage ? (
            <button
              type="button"
              className="primary"
              onClick={() => openCreate()}
              disabled={user?.role !== UserRole.StudioAdmin && studios.length === 0}
            >
              Добавить
            </button>
          ) : null}
        </div>
        <p className="page-subtitle">
          Администраторы студий и прочие роли без графика приёма. Специалистов ведите в разделе
          «Специалисты».
        </p>
      </div>

      <FilterBar
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onReset={() => {
          setSearchQuery('');
          setStudioFilterId('');
        }}
        resetDisabled={searchQuery.trim() === '' && studioFilterId.trim() === ''}
        foundCount={filteredRows.length}
        totalCount={rows.length}
        placeholder="ФИО, роль, телефон, email, студия"
      >
        {canFilterByStudio ? (
          <div className="field" style={{ minWidth: 260, maxWidth: 380 }}>
            <label htmlFor="staff-filter-studio">Фильтр по студии</label>
            <select
              id="staff-filter-studio"
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
      </FilterBar>

      {user?.role !== UserRole.StudioAdmin && studios.length === 0 && !loading ? (
        <div className="surface-card">
          <p style={{ color: 'var(--muted)', margin: 0 }}>Сначала создайте студию на странице «Студии».</p>
        </div>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Загрузка…</p>
      ) : (
        <div className="table-wrap sticky-head">
          <table>
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Роль</th>
                <th>Студия</th>
                <th>Email</th>
                <th>Телефон</th>
                {manage ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.lastName} {r.firstName}
                      {r.middleName ? ` ${r.middleName}` : ''}
                    </td>
                    <td>{roleLabelRu(r.role)}</td>
                    <td>{studioLabel(r)}</td>
                    <td>{r.email ?? '—'}</td>
                    <td className="mono">{r.phone}</td>
                    {manage ? (
                      <td>
                        <span className="inline-actions">
                          <button
                            type="button"
                            className="action-icon-btn"
                            aria-label="Изменить сотрудника"
                            title="Изменить"
                            onClick={() => openEdit(r)}
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="danger action-icon-btn"
                            aria-label="Удалить сотрудника"
                            title="Удалить"
                            onClick={() => void removeRow(r)}
                            disabled={r.id === user?.id}
                          >
                            <DeleteIcon />
                          </button>
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={manage ? 6 : 5} style={{ color: 'var(--muted)' }}>
                    Ничего не найдено. Попробуйте изменить фильтры.
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
            style={{ width: 'min(520px, 100%)' }}
            role="dialog"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2>{modal.mode === 'create' ? 'Новый сотрудник' : 'Редактирование'}</h2>
            <form onSubmit={(ev) => void submitModal(ev)}>
              <div className="field">
                <label htmlFor="stf-role">Роль</label>
                <select
                  id="stf-role"
                  value={modal.form.role}
                  onChange={(ev) =>
                    setModal({
                      ...modal,
                      form: { ...modal.form, role: ev.target.value as UserRole },
                    })
                  }
                  required
                >
                  {rolesForActor.map((role) => (
                    <option key={role} value={role}>
                      {roleLabelRu(role)}
                    </option>
                  ))}
                </select>
              </div>

              {roleNeedsStudio(modal.form.role) && user?.role !== UserRole.StudioAdmin ? (
                <div className="field">
                  <label htmlFor="stf-studio">Студия</label>
                  <select
                    id="stf-studio"
                    value={modal.form.studioId}
                    onChange={(ev) =>
                      setModal({
                        ...modal,
                        form: { ...modal.form, studioId: ev.target.value },
                      })
                    }
                    required
                  >
                    {studios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.city})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {user?.role === UserRole.StudioAdmin && roleNeedsStudio(modal.form.role) ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 0 }}>
                  Сотрудник будет привязан к вашей студии.
                </p>
              ) : null}

              <div className="field">
                <label htmlFor="stf-email">Email (вход в админку)</label>
                <input
                  id="stf-email"
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
                <label htmlFor="stf-pass">
                  Пароль {modal.mode === 'edit' ? '(оставьте пустым, чтобы не менять)' : ''}
                </label>
                <input
                  id="stf-pass"
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
                <label htmlFor="stf-phone">Телефон</label>
                <input
                  id="stf-phone"
                  className="mono"
                  value={modal.form.phone}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, phone: ev.target.value } })
                  }
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="stf-ln">Фамилия</label>
                <input
                  id="stf-ln"
                  value={modal.form.lastName}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, lastName: ev.target.value } })
                  }
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="stf-fn">Имя</label>
                <input
                  id="stf-fn"
                  value={modal.form.firstName}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, firstName: ev.target.value } })
                  }
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="stf-mn">Отчество</label>
                <input
                  id="stf-mn"
                  value={modal.form.middleName}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, middleName: ev.target.value } })
                  }
                />
              </div>

              {modal.mode === 'edit' ? (
                <div className="field">
                  <label className="modal-toggle">
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
                  {modal.id === user?.id ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.35rem 0 0' }}>
                      Флаг «Активен» для своей учётной записи меняется только другим администратором.
                    </p>
                  ) : null}
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
