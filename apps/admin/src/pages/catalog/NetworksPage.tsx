import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';


import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { slugify } from '../../lib/identifiers';
import { canMutateTenantCatalog } from '../../lib/roles';
import { DeleteIcon } from '../../ui/DeleteIcon';
import EditIcon from '../../ui/EditIcon';
import { FilterBar } from '../../ui/FilterBar';
import { useToast } from '../../ui/ToastContext';

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
  const { showToast } = useToast();
  const canMutate = user ? canMutateTenantCatalog(user.role) : false;
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<NetworkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; form: NetworkFormState; id?: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [slugEditedManually, setSlugEditedManually] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const debouncedQuery = useDebouncedValue(searchQuery);

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
      showToast(modal.mode === 'create' ? 'Сеть создана' : 'Сеть обновлена', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
      showToast('Не удалось сохранить сеть', 'error');
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
      showToast('Сеть удалена', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
      showToast('Не удалось удалить сеть', 'error');
    }
  }

  const filteredRows = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [rows, debouncedQuery]);

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
            Сети
          </h1>
          {canMutate ? (
            <button
              type="button"
              className="primary"
              onClick={() => {
                setSlugEditedManually(false);
                setModal({ mode: 'create', form: emptyForm });
              }}
            >
              Новая сеть
            </button>
          ) : null}
        </div>
        <p className="page-subtitle">
          Корневой уровень структуры: сеть объединяет студии, сотрудников, услуги и товары.
        </p>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <FilterBar
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onReset={() => setSearchQuery('')}
        resetDisabled={searchQuery.trim() === ''}
        foundCount={filteredRows.length}
        totalCount={rows.length}
        placeholder="Название, slug или id сети"
      />

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Загрузка…</p>
      ) : (
        <div className="table-wrap sticky-head">
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
              {filteredRows.length > 0 ? (
                filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="mono">{r.slug}</td>
                    <td className="mono" style={{ fontSize: '0.78rem' }}>
                      {r.id}
                    </td>
                    {canMutate ? (
                      <td>
                        <span className="inline-actions">
                          <button
                            type="button"
                            className="action-icon-btn"
                            aria-label="Изменить сеть"
                            title="Изменить"
                            onClick={() => {
                              setSlugEditedManually(true);
                              setModal({
                                mode: 'edit',
                                id: r.id,
                                form: {
                                  name: r.name,
                                  slug: r.slug,
                                  description: r.description ?? '',
                                  logoUrl: r.logoUrl ?? '',
                                },
                              });
                            }}
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="danger action-icon-btn"
                            aria-label="Удалить сеть"
                            title="Удалить"
                            onClick={() => void remove(r.id, r.name)}
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
                  <td colSpan={canMutate ? 4 : 3} style={{ color: 'var(--muted)' }}>
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
          <div className="modal" role="dialog" onClick={(ev) => ev.stopPropagation()}>
            <h2>{modal.mode === 'create' ? 'Новая сеть' : 'Редактирование сети'}</h2>
            <form onSubmit={(ev) => void submitModal(ev)}>
              <div className="field">
                <label htmlFor="net-name">Название</label>
                <input
                  id="net-name"
                  value={modal.form.name}
                  onChange={(ev) =>
                    setModal((prev) => {
                      if (!prev) return prev;
                      const nextName = ev.target.value;
                      return {
                        ...prev,
                        form: {
                          ...prev.form,
                          name: nextName,
                          slug:
                            !slugEditedManually || prev.form.slug.trim() === ''
                              ? slugify(nextName)
                              : prev.form.slug,
                        },
                      };
                    })
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
                  onFocus={() => setSlugEditedManually(true)}
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
