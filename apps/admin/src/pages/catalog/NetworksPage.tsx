import { useCallback, useEffect, useState } from 'react';


import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { canMutateTenantCatalog } from '../../lib/roles';

import type { NetworkRow } from './network-types';
import type { FormEvent } from 'react';

interface NetworkFormState {
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
}

const emptyForm: NetworkFormState = {
  name: '',
  slug: '',
  description: '',
  logoUrl: '',
};

export function NetworksPage() {
  const { user } = useAuth();
  const canMutate = user ? canMutateTenantCatalog(user.role) : false;

  const [rows, setRows] = useState<NetworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; form: NetworkFormState; id?: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<NetworkRow[]>('/admin/catalog/networks');
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

  async function submitModal(ev: FormEvent) {
    ev.preventDefault();
    if (!modal) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: modal.form.name.trim(),
        slug: modal.form.slug.trim(),
        description: modal.form.description.trim() || undefined,
        logoUrl: modal.form.logoUrl.trim() || undefined,
      };
      if (modal.mode === 'create') {
        await apiRequest('/admin/catalog/networks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (modal.id) {
        await apiRequest(`/admin/catalog/networks/${modal.id}`, {
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

  async function remove(id: string, name: string) {
    if (!globalThis.confirm(`Удалить сеть «${name}»? Допустимо только без студий.`)) return;
    setError(null);
    try {
      await apiRequest(`/admin/catalog/networks/${id}`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
    }
  }

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0, flex: 1 }}>Сети</h1>
        {canMutate ? (
          <button
            type="button"
            className="primary"
            onClick={() => setModal({ mode: 'create', form: emptyForm })}
          >
            Новая сеть
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
                <th>Название</th>
                <th>slug</th>
                <th>id</th>
                {canMutate ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="mono">{r.slug}</td>
                  <td className="mono" style={{ fontSize: '0.78rem' }}>
                    {r.id}
                  </td>
                  {canMutate ? (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setModal({
                            mode: 'edit',
                            id: r.id,
                            form: {
                              name: r.name,
                              slug: r.slug,
                              description: r.description ?? '',
                              logoUrl: r.logoUrl ?? '',
                            },
                          })
                        }
                      >
                        Изменить
                      </button>{' '}
                      <button type="button" className="danger" onClick={() => void remove(r.id, r.name)}>
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
            <h2>{modal.mode === 'create' ? 'Новая сеть' : 'Редактирование сети'}</h2>
            <form onSubmit={(ev) => void submitModal(ev)}>
              <div className="field">
                <label htmlFor="net-name">Название</label>
                <input
                  id="net-name"
                  value={modal.form.name}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, name: ev.target.value } })
                  }
                  required
                  minLength={2}
                />
              </div>
              <div className="field">
                <label htmlFor="net-slug">slug</label>
                <input
                  id="net-slug"
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
                <label htmlFor="net-desc">Описание</label>
                <textarea
                  id="net-desc"
                  rows={3}
                  value={modal.form.description}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, description: ev.target.value } })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="net-logo">logo URL</label>
                <input
                  id="net-logo"
                  type="url"
                  value={modal.form.logoUrl}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, logoUrl: ev.target.value } })
                  }
                />
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
