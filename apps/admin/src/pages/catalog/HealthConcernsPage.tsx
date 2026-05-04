import { useCallback, useEffect, useState } from 'react';


import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { canMutateTenantCatalog } from '../../lib/roles';

import type { FormEvent } from 'react';

interface Row {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface FormState {
  slug: string;
  title: string;
  description: string;
  iconUrl: string;
  sortOrder: string;
  isActive: boolean;
}

const empty: FormState = {
  slug: '',
  title: '',
  description: '',
  iconUrl: '',
  sortOrder: '0',
  isActive: true,
};

export function HealthConcernsPage() {
  const { user } = useAuth();
  const canMutate = user ? canMutateTenantCatalog(user.role) : false;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; id?: string; form: FormState } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<Row[]>('/admin/catalog/health-concerns');
      setRows(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!modal) return;
    setSaving(true);
    setError(null);
    try {
      const sortOrder = Number(modal.form.sortOrder);
      const payload = {
        slug: modal.form.slug.trim(),
        title: modal.form.title.trim(),
        description: modal.form.description.trim() || undefined,
        iconUrl: modal.form.iconUrl.trim() || undefined,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        isActive: modal.form.isActive,
      };
      if (modal.mode === 'create') {
        await apiRequest('/admin/catalog/health-concerns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (modal.id) {
        await apiRequest(`/admin/catalog/health-concerns/${modal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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

  async function remove(id: string, title: string) {
    if (!globalThis.confirm(`Удалить «${title}»?`)) return;
    setError(null);
    try {
      await apiRequest(`/admin/catalog/health-concerns/${id}`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
    }
  }

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0, flex: 1 }}>Жалобы (что беспокоит)</h1>
        {canMutate ? (
          <button type="button" className="primary" onClick={() => setModal({ mode: 'create', form: empty })}>
            Новая запись
          </button>
        ) : null}
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Загрузка…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Заголовок</th>
                <th>slug</th>
                <th>Порядок</th>
                <th>Активна</th>
                {canMutate ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td className="mono">{r.slug}</td>
                  <td>{r.sortOrder}</td>
                  <td>{r.isActive ? 'да' : 'нет'}</td>
                  {canMutate ? (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setModal({
                            mode: 'edit',
                            id: r.id,
                            form: {
                              slug: r.slug,
                              title: r.title,
                              description: r.description ?? '',
                              iconUrl: r.iconUrl ?? '',
                              sortOrder: String(r.sortOrder),
                              isActive: r.isActive,
                            },
                          })
                        }
                      >
                        Изменить
                      </button>{' '}
                      <button type="button" className="danger" onClick={() => void remove(r.id, r.title)}>
                        Удалить
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
          <div className="modal" role="dialog" onClick={(ev) => ev.stopPropagation()}>
            <h2>{modal.mode === 'create' ? 'Новая жалоба' : 'Редактирование'}</h2>
            <form onSubmit={(ev) => void submit(ev)}>
              <div className="field">
                <label htmlFor="hc-slug">slug</label>
                <input
                  id="hc-slug"
                  className="mono"
                  value={modal.form.slug}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, slug: ev.target.value } })
                  }
                  required
                  pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                />
              </div>
              <div className="field">
                <label htmlFor="hc-title">Заголовок</label>
                <input
                  id="hc-title"
                  value={modal.form.title}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, title: ev.target.value } })
                  }
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="hc-desc">Описание</label>
                <textarea
                  id="hc-desc"
                  rows={3}
                  value={modal.form.description}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, description: ev.target.value } })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="hc-icon">Иконка URL</label>
                <input
                  id="hc-icon"
                  type="url"
                  value={modal.form.iconUrl}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, iconUrl: ev.target.value } })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="hc-sort">Порядок сортировки</label>
                <input
                  id="hc-sort"
                  type="number"
                  value={modal.form.sortOrder}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, sortOrder: ev.target.value } })
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
