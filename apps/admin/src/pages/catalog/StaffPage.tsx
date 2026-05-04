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
  const manage = user ? canManageStaff(user.role) : false;
  const canFilterByStudio = user ? canMutateTenantCatalog(user.role) : false;

  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [studioFilterId, setStudioFilterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    mode: 'create' | 'edit';
    id?: string;
    form: StaffFormState;
  } | null>(null);
  const [saving, setSaving] = useState(false);

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
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
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
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
    }
  }

  const studioLabel = (r: StaffRow) =>
    r.studio ? `${r.studio.name}, ${r.studio.city}` : '—';

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0, flex: 1 }}>Сотрудники</h1>
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

      <p style={{ color: 'var(--muted)', marginTop: 0, fontSize: '0.9rem' }}>
        Администраторы студий и прочие роли без графика приёма. Специалистов ведите в разделе «Специалисты».
      </p>

      {canFilterByStudio ? (
        <div className="field" style={{ maxWidth: 420, marginBottom: '1rem' }}>
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

      {user?.role !== UserRole.StudioAdmin && studios.length === 0 && !loading ? (
        <p style={{ color: 'var(--muted)' }}>
          Сначала создайте студию на странице «Студии».
        </p>
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
                <th>Роль</th>
                <th>Студия</th>
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
                  <td>{roleLabelRu(r.role)}</td>
                  <td>{studioLabel(r)}</td>
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
