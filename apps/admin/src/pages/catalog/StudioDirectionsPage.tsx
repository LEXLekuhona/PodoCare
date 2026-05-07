import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { slugify } from '../../lib/identifiers';
import { canMutateTenantCatalog } from '../../lib/roles';
import { FilterBar } from '../../ui/FilterBar';
import { useToast } from '../../ui/ToastContext';

import type { FormEvent } from 'react';

/** Синхронизировано с API `STUDIO_DIRECTION_ICON_KEYS`. */
const ICON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'spa', label: 'spa — система / wellness' },
  { value: 'shoe-prints', label: 'shoe-prints — стопы' },
  { value: 'leaf', label: 'leaf — натуропатия' },
  { value: 'hands', label: 'hands — ручные техники' },
  { value: 'magic', label: 'magic — косметология' },
  { value: 'heartbeat', label: 'heartbeat' },
  { value: 'medkit', label: 'medkit' },
  { value: 'seedling', label: 'seedling' },
  { value: 'star', label: 'star' },
];

interface Row {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  iconKey: string;
  sortOrder: number;
  isActive: boolean;
}

interface FormState {
  slug: string;
  title: string;
  description: string;
  iconKey: string;
  isActive: boolean;
}

const empty: FormState = {
  slug: '',
  title: '',
  description: '',
  iconKey: 'spa',
  isActive: true,
};

function nextSortOrder(items: Array<{ sortOrder: number }>): number {
  const maxSortOrder = items.reduce((max, item) => Math.max(max, item.sortOrder), -10);
  return maxSortOrder + 10;
}

export function StudioDirectionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canMutate = user ? canMutateTenantCatalog(user.role) : false;
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; id?: string; form: FormState } | null>(
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
      const data = await apiRequest<Row[]>('/admin/catalog/studio-directions');
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
      const payload = {
        slug: modal.form.slug.trim(),
        title: modal.form.title.trim(),
        description: modal.form.description.trim() || undefined,
        iconKey: modal.form.iconKey.trim(),
        ...(modal.mode === 'create' ? { sortOrder: nextSortOrder(rows) } : {}),
        isActive: modal.form.isActive,
      };
      if (modal.mode === 'create') {
        await apiRequest('/admin/catalog/studio-directions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (modal.id) {
        await apiRequest(`/admin/catalog/studio-directions/${modal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setModal(null);
      await reload();
      showToast(modal.mode === 'create' ? 'Направление создано' : 'Направление обновлено', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
      showToast('Не удалось сохранить', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, title: string) {
    if (!globalThis.confirm(`Удалить направление «${title}»?`)) return;
    setError(null);
    try {
      await apiRequest(`/admin/catalog/studio-directions/${id}`, { method: 'DELETE' });
      await reload();
      showToast('Удалено', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
      showToast('Не удалось удалить', 'error');
    }
  }

  const filteredRows = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.title.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        r.iconKey.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
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
            Направления студии
          </h1>
          {canMutate ? (
            <button
              type="button"
              className="primary"
              onClick={() => {
                setSlugEditedManually(false);
                setModal({ mode: 'create', form: empty });
              }}
            >
              Новое направление
            </button>
          ) : null}
        </div>
        <p className="page-subtitle">
          Карточки горизонтального блока «Направления студии» на главном экране приложения. Текст на экране
          направления — поле «Описание». Иконка: имя глифа Font Awesome 5 (solid), как в мобильном клиенте.
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
        placeholder="Заголовок, slug, иконка или описание"
      />

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Загрузка…</p>
      ) : (
        <div className="table-wrap sticky-head">
          <table>
            <thead>
              <tr>
                <th>Заголовок</th>
                <th>slug</th>
                <th>Иконка</th>
                <th>Порядок</th>
                <th>Активно</th>
                {canMutate ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td className="mono">{r.slug}</td>
                    <td className="mono">{r.iconKey}</td>
                    <td>{r.sortOrder}</td>
                    <td>{r.isActive ? 'да' : 'нет'}</td>
                    {canMutate ? (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSlugEditedManually(true);
                            setModal({
                              mode: 'edit',
                              id: r.id,
                              form: {
                                slug: r.slug,
                                title: r.title,
                                description: r.description ?? '',
                                iconKey: r.iconKey,
                                isActive: r.isActive,
                              },
                            });
                          }}
                        >
                          Изменить
                        </button>{' '}
                        <button type="button" className="danger" onClick={() => void remove(r.id, r.title)}>
                          Удалить
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canMutate ? 6 : 5} style={{ color: 'var(--muted)' }}>
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
            <h2>{modal.mode === 'create' ? 'Новое направление' : 'Редактирование'}</h2>
            <form onSubmit={(ev) => void submit(ev)}>
              <div className="field">
                <label htmlFor="sd-slug">slug</label>
                <input
                  id="sd-slug"
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
                <label htmlFor="sd-title">Заголовок</label>
                <input
                  id="sd-title"
                  value={modal.form.title}
                  onChange={(ev) =>
                    setModal((prev) => {
                      if (!prev) return prev;
                      const nextTitle = ev.target.value;
                      return {
                        ...prev,
                        form: {
                          ...prev.form,
                          title: nextTitle,
                          slug:
                            !slugEditedManually || prev.form.slug.trim() === ''
                              ? slugify(nextTitle)
                              : prev.form.slug,
                        },
                      };
                    })
                  }
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="sd-icon">Иконка (Font Awesome 5)</label>
                <select
                  id="sd-icon"
                  className="mono"
                  value={modal.form.iconKey}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, iconKey: ev.target.value } })
                  }
                  required
                >
                  {ICON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sd-desc">Описание (экран направления)</label>
                <textarea
                  id="sd-desc"
                  rows={6}
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
                  Показывать в приложении
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
