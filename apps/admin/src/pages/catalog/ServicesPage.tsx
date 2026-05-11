import { UserRole } from '@srs/shared-types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { slugify } from '../../lib/identifiers';
import { canManageStaff, canMutateTenantCatalog } from '../../lib/roles';
import { DeleteIcon } from '../../ui/DeleteIcon';
import EditIcon from '../../ui/EditIcon';
import { FilterBar } from '../../ui/FilterBar';

import type { FormEvent } from 'react';

interface StudioRow {
  id: string;
  name: string;
  city: string;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface CategoryFormState {
  name: string;
  slug: string;
  description: string;
  color: string;
  isActive: boolean;
}

interface ServiceRow {
  id: string;
  studioId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  prepaymentRequired: boolean;
  prepaymentMinor: number | null;
  imageUrl: string | null;
  requiresConsultation: boolean;
  isActive: boolean;
  sortOrder: number;
}

type ServiceSortField = 'category' | 'name' | 'durationMinutes' | 'priceMinor';
type SortDirection = 'asc' | 'desc';

interface FormState {
  name: string;
  description: string;
  categoryId: string;
  durationMinutes: string;
  priceRubles: string;
  prepaymentRequired: boolean;
  prepaymentRubles: string;
  imageUrl: string;
  requiresConsultation: boolean;
  isActive: boolean;
}

function emptyForm(): FormState {
  return {
    name: '',
    description: '',
    categoryId: '',
    durationMinutes: '60',
    priceRubles: '0',
    prepaymentRequired: false,
    prepaymentRubles: '0',
    imageUrl: '',
    requiresConsultation: false,
    isActive: true,
  };
}

function rowToForm(r: ServiceRow): FormState {
  return {
    name: r.name,
    description: r.description ?? '',
    categoryId: r.categoryId ?? '',
    durationMinutes: String(r.durationMinutes),
    priceRubles: String(Math.round(r.priceMinor / 100)),
    prepaymentRequired: r.prepaymentRequired,
    prepaymentRubles: String(r.prepaymentMinor != null ? Math.round(r.prepaymentMinor / 100) : 0),
    imageUrl: r.imageUrl ?? '',
    requiresConsultation: r.requiresConsultation,
    isActive: r.isActive,
  };
}

function emptyCategoryForm(): CategoryFormState {
  return {
    name: '',
    slug: '',
    description: '',
    color: '#2D6A4F',
    isActive: true,
  };
}

function categoryToForm(r: CategoryRow): CategoryFormState {
  return {
    name: r.name,
    slug: r.slug,
    description: '',
    color: r.color ?? '#2D6A4F',
    isActive: r.isActive,
  };
}

function nextSortOrder(items: Array<{ sortOrder: number }>): number {
  const maxSortOrder = items.reduce((max, item) => Math.max(max, item.sortOrder), -10);
  return maxSortOrder + 10;
}

export function ServicesPage() {
  const { user } = useAuth();
  const manage = user ? canManageStaff(user.role) : false;
  const studioAdmin = user?.role === UserRole.StudioAdmin;
  const [searchParams, setSearchParams] = useSearchParams();

  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [studioId, setStudioId] = useState(() => searchParams.get('studio') ?? '');
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; id?: string; form: FormState } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  // Categories modal state
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [categoryModal, setCategoryModal] = useState<
    { mode: 'create' | 'edit'; id?: string; form: CategoryFormState } | null
  >(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categorySlugEditedManually, setCategorySlugEditedManually] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [sortField, setSortField] = useState<ServiceSortField>('category');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const debouncedQuery = useDebouncedValue(searchQuery);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studioData, categoryData] = await Promise.all([
        apiRequest<StudioRow[]>('/admin/catalog/studios'),
        apiRequest<CategoryRow[]>('/admin/catalog/service-categories'),
      ]);
      setStudios(studioData);
      setCategories(categoryData.filter((c) => c.isActive !== false));
      if (studioData.length > 0) {
        setStudioId((prev) => {
          if (prev && studioData.some((s) => s.id === prev)) {
            return prev;
          }
          return studioData[0]!.id;
        });
      } else {
        setStudioId('');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [studioAdmin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadServices = useCallback(async () => {
    if (!studioId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ServiceRow[]>(`/admin/catalog/studios/${studioId}/services`);
      setRows(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки услуг');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [studioId]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const studioLabel = useMemo(() => {
    const s = studios.find((x) => x.id === studioId);
    return s ? `${s.name} (${s.city})` : '';
  }, [studios, studioId]);

  const filteredRows = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const categoryName = categories.find((c) => c.id === r.categoryId)?.name ?? '';
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        categoryName.toLowerCase().includes(q)
      );
    });
  }, [rows, categories, debouncedQuery]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let left: string | number = '';
      let right: string | number = '';
      if (sortField === 'category') {
        left = categories.find((c) => c.id === a.categoryId)?.name ?? '';
        right = categories.find((c) => c.id === b.categoryId)?.name ?? '';
      } else if (sortField === 'name') {
        left = a.name;
        right = b.name;
      } else if (sortField === 'durationMinutes') {
        left = a.durationMinutes;
        right = b.durationMinutes;
      } else if (sortField === 'priceMinor') {
        left = a.priceMinor;
        right = b.priceMinor;
      }

      if (typeof left === 'number' && typeof right === 'number') {
        const result = left - right;
        return sortDirection === 'asc' ? result : -result;
      }

      const result = String(left).localeCompare(String(right), 'ru', { sensitivity: 'base' });
      return sortDirection === 'asc' ? result : -result;
    });
    return sorted;
  }, [filteredRows, categories, sortField, sortDirection]);

  function toggleSort(field: ServiceSortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDirection('asc');
  }

  function sortMark(field: ServiceSortField): string {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  useEffect(() => {
    const next = new URLSearchParams();
    const studio = studioId.trim();
    const q = searchQuery.trim();
    if (studio) next.set('studio', studio);
    if (q) next.set('q', q);
    setSearchParams(next, { replace: true });
  }, [studioId, searchQuery, setSearchParams]);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!modal || !studioId) return;

    const durationMinutes = Number(modal.form.durationMinutes);
    const priceRubles = Number(modal.form.priceRubles);
    const prepaymentRubles = Number(modal.form.prepaymentRubles);

    if (!Number.isFinite(durationMinutes) || durationMinutes < 5) {
      setError('Длительность: не меньше 5 минут');
      return;
    }
    if (!Number.isFinite(priceRubles) || priceRubles < 0 || !Number.isInteger(priceRubles)) {
      setError('Цена: целое число рублей ≥ 0');
      return;
    }
    if (modal.form.prepaymentRequired) {
      if (!Number.isFinite(prepaymentRubles) || prepaymentRubles < 0 || !Number.isInteger(prepaymentRubles)) {
        setError('Предоплата: целое число рублей ≥ 0');
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const img = modal.form.imageUrl.trim();
      const catId = modal.form.categoryId.trim();
      const payload = {
        name: modal.form.name.trim(),
        description: modal.form.description.trim() || undefined,
        durationMinutes,
        priceRubles,
        prepaymentRequired: modal.form.prepaymentRequired,
        requiresConsultation: modal.form.requiresConsultation,
        isActive: modal.form.isActive,
        ...(modal.mode === 'create' ? { sortOrder: nextSortOrder(rows) } : {}),
        ...(img ? { imageUrl: img } : {}),
        ...(modal.form.prepaymentRequired ? { prepaymentRubles } : {}),
        ...(catId ? { categoryId: catId } : {}),
      };

      if (modal.mode === 'create') {
        await apiRequest(`/admin/catalog/studios/${studioId}/services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (modal.id) {
        await apiRequest(`/admin/catalog/studios/${studioId}/services/${modal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setModal(null);
      await loadServices();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: ServiceRow) {
    if (!studioId) return;
    if (!globalThis.confirm(`Удалить услугу «${row.name}»?`)) return;
    setError(null);
    try {
      await apiRequest(`/admin/catalog/studios/${studioId}/services/${row.id}`, { method: 'DELETE' });
      await loadServices();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
    }
  }

  // Category management functions
  const reloadCategories = useCallback(async () => {
    try {
      const data = await apiRequest<CategoryRow[]>('/admin/catalog/service-categories');
      setCategories(data.filter((c) => c.isActive !== false));
    } catch {
      // silent fail
    }
  }, []);

  async function submitCategory(ev: FormEvent) {
    ev.preventDefault();
    if (!categoryModal) return;

    const slug = categoryModal.form.slug.trim().toLowerCase();

    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError('slug: только строчные латинские буквы, цифры и дефисы');
      return;
    }

    const color = categoryModal.form.color.trim();
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      setError('Цвет: HEX формат (#RRGGBB)');
      return;
    }

    setSavingCategory(true);
    setError(null);
    try {
      const payload = {
        name: categoryModal.form.name.trim(),
        slug,
        description: categoryModal.form.description.trim() || undefined,
        color: color || undefined,
        ...(categoryModal.mode === 'create' ? { sortOrder: nextSortOrder(categories) } : {}),
        isActive: categoryModal.form.isActive,
      };

      if (categoryModal.mode === 'create') {
        await apiRequest('/admin/catalog/service-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (categoryModal.id) {
        await apiRequest(`/admin/catalog/service-categories/${categoryModal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setCategoryModal(null);
      await reloadCategories();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
    } finally {
      setSavingCategory(false);
    }
  }

  async function removeCategory(row: CategoryRow) {
    if (!globalThis.confirm(`Удалить направление «${row.name}»?`)) return;
    setError(null);
    try {
      await apiRequest(`/admin/catalog/service-categories/${row.id}`, { method: 'DELETE' });
      await reloadCategories();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
    }
  }

  const canManageCategories = user ? canMutateTenantCatalog(user.role) : false;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <h1 className="page-title" style={{ flex: 1 }}>
            Услуги студий
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {canManageCategories ? (
              <button
                type="button"
                onClick={() => {
                  void reloadCategories();
                  setCategoriesModalOpen(true);
                }}
              >
                Направления
              </button>
            ) : null}
            {manage && studioId ? (
              <button
                type="button"
                className="primary"
                onClick={() => setModal({ mode: 'create', form: emptyForm() })}
              >
                Новая услуга
              </button>
            ) : null}
          </div>
        </div>
        <p className="page-subtitle">
          Активные услуги с ценой и длительностью попадают в мобильное приложение при выборе студии.
          Отметьте у специалиста, какие услуги он оказывает — иначе при записи к мастеру список может быть
          пустым.
        </p>
      </div>

      <div className="surface-card">
        <div className="field" style={{ maxWidth: 420, marginBottom: 0 }}>
          <label htmlFor="svc-studio">Студия</label>
          <select
            id="svc-studio"
            value={studioId}
            disabled={studioAdmin || studios.length === 0}
            onChange={(ev) => setStudioId(ev.target.value)}
          >
            {studios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.city})
              </option>
            ))}
          </select>
          {studioAdmin ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.35rem 0 0' }}>
              Доступна только ваша студия.
            </p>
          ) : null}
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {studioId ? (
        <FilterBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onReset={() => setSearchQuery('')}
          resetDisabled={searchQuery.trim() === ''}
          foundCount={filteredRows.length}
          totalCount={rows.length}
          placeholder="Название, описание или направление"
        />
      ) : null}

      {!studioId ? (
        <p style={{ color: 'var(--muted)' }}>Выберите студию, чтобы увидеть услуги.</p>
      ) : loading ? (
        <p style={{ color: 'var(--muted)' }}>Загрузка…</p>
      ) : (
        <div className="table-wrap sticky-head">
          <table>
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    onClick={() => toggleSort('category')}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    Направление <span>{sortMark('category')}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    Название <span>{sortMark('name')}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => toggleSort('durationMinutes')}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    Время <span>{sortMark('durationMinutes')}</span>
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => toggleSort('priceMinor')}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    Цена <span>{sortMark('priceMinor')}</span>
                  </button>
                </th>
                {manage ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length > 0 ? (
                sortedRows.map((r) => {
                const category = categories.find((c) => c.id === r.categoryId);
                return (
                  <tr key={r.id}>
                    <td>
                      {category ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {category.color ? (
                            <span
                              style={{
                                display: 'inline-block',
                                width: 12,
                                height: 12,
                                borderRadius: 3,
                                backgroundColor: category.color,
                                border: '1px solid rgba(0,0,0,0.1)',
                              }}
                            />
                          ) : null}
                          {category.name}
                        </span>
                      ) : '—'}
                    </td>
                    <td>{r.name}</td>
                    <td>{r.durationMinutes}</td>
                    <td>
                      {(r.priceMinor / 100).toLocaleString('ru-RU')} {r.currency}
                    </td>
                    {manage ? (
                      <td>
                        <div className="table-action-row">
                        <button
                          type="button"
                          className="action-icon-btn"
                          aria-label="Изменить услугу"
                          title="Изменить"
                          onClick={() => setModal({ mode: 'edit', id: r.id, form: rowToForm(r) })}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="danger action-icon-btn"
                          aria-label="Удалить услугу"
                          title="Удалить"
                          onClick={() => void remove(r)}
                        >
                          <DeleteIcon />
                        </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })
              ) : (
                <tr>
                  <td colSpan={manage ? 5 : 4} style={{ color: 'var(--muted)' }}>
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
            style={{ width: 'min(520px, 100%)' }}
            role="dialog"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2>{modal.mode === 'create' ? 'Новая услуга' : 'Редактирование услуги'}</h2>
            {studioLabel ? (
              <p style={{ color: 'var(--muted)', marginTop: 0, fontSize: '0.9rem' }}>{studioLabel}</p>
            ) : null}
            <form onSubmit={(ev) => void submit(ev)}>
              <div className="field">
                <label htmlFor="svc-name">Название</label>
                <input
                  id="svc-name"
                  value={modal.form.name}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, name: ev.target.value } })
                  }
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="svc-desc">Описание</label>
                <textarea
                  id="svc-desc"
                  rows={3}
                  value={modal.form.description}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, description: ev.target.value } })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="svc-category">Направление деятельности</label>
                <select
                  id="svc-category"
                  value={modal.form.categoryId}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, categoryId: ev.target.value } })
                  }
                >
                  <option value="">— без категории —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.35rem 0 0' }}>
                  Сначала создайте направления в разделе «Направления».
                </p>
              </div>
              <div className="field">
                <label htmlFor="svc-dur">Длительность (мин)</label>
                <input
                  id="svc-dur"
                  type="number"
                  min={5}
                  value={modal.form.durationMinutes}
                  onChange={(ev) =>
                    setModal({
                      ...modal,
                      form: { ...modal.form, durationMinutes: ev.target.value },
                    })
                  }
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="svc-price">Цена (₽, целое)</label>
                <input
                  id="svc-price"
                  type="number"
                  min={0}
                  step={1}
                  value={modal.form.priceRubles}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, priceRubles: ev.target.value } })
                  }
                  required
                />
              </div>
              <div className="field">
                <label className="modal-toggle">
                  <input
                    type="checkbox"
                    checked={modal.form.prepaymentRequired}
                    onChange={(ev) =>
                      setModal({
                        ...modal,
                        form: { ...modal.form, prepaymentRequired: ev.target.checked },
                      })
                    }
                  />{' '}
                  Нужна предоплата
                </label>
              </div>
              {modal.form.prepaymentRequired ? (
                <div className="field">
                  <label htmlFor="svc-prepay">Предоплата (₽)</label>
                  <input
                    id="svc-prepay"
                    type="number"
                    min={0}
                    step={1}
                    value={modal.form.prepaymentRubles}
                    onChange={(ev) =>
                      setModal({
                        ...modal,
                        form: { ...modal.form, prepaymentRubles: ev.target.value },
                      })
                    }
                  />
                </div>
              ) : null}
              <div className="field">
                <label htmlFor="svc-img">URL изображения</label>
                <input
                  id="svc-img"
                  value={modal.form.imageUrl}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, imageUrl: ev.target.value } })
                  }
                />
              </div>
              <div className="field">
                <label className="modal-toggle">
                  <input
                    type="checkbox"
                    checked={modal.form.requiresConsultation}
                    onChange={(ev) =>
                      setModal({
                        ...modal,
                        form: { ...modal.form, requiresConsultation: ev.target.checked },
                      })
                    }
                  />{' '}
                  Требуется консультация
                </label>
              </div>
              <div className="field">
                <label className="modal-toggle">
                  <input
                    type="checkbox"
                    checked={modal.form.isActive}
                    onChange={(ev) =>
                      setModal({ ...modal, form: { ...modal.form, isActive: ev.target.checked } })
                    }
                  />{' '}
                  Активна (видна в приложении)
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

      {/* Categories Management Modal */}
      {categoriesModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            setCategoriesModalOpen(false);
            setCategoryModal(null);
          }}
        >
          <div
            className="modal"
            style={{ width: 'min(600px, 100%)' }}
            role="dialog"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Направления деятельности</h2>
              <button
                type="button"
                onClick={() => {
                  setCategoriesModalOpen(false);
                  setCategoryModal(null);
                }}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <p style={{ color: 'var(--muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Категории услуг: Подология, Остеопатия, Массаж и т.д. Используются для группировки услуг и
              назначения специалистам.
            </p>

            {canManageCategories && !categoryModal ? (
              <div style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setCategorySlugEditedManually(false);
                    setCategoryModal({ mode: 'create', form: emptyCategoryForm() });
                  }}
                >
                  Новое направление
                </button>
              </div>
            ) : null}

            {categoryModal ? (
              <form onSubmit={(ev) => void submitCategory(ev)} style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.03)', borderRadius: 8 }}>
                <h3 style={{ marginTop: 0 }}>{categoryModal.mode === 'create' ? 'Новое направление' : 'Редактирование'}</h3>
                <div className="field">
                  <label htmlFor="cat-name">Название</label>
                  <input
                    id="cat-name"
                    value={categoryModal.form.name}
                    onChange={(ev) => {
                      const name = ev.target.value;
                      const next = { ...categoryModal.form, name };
                      if (!categorySlugEditedManually || categoryModal.form.slug.trim() === '') {
                        next.slug = slugify(name);
                      }
                      setCategoryModal({ ...categoryModal, form: next });
                    }}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="cat-slug">Slug (URL)</label>
                  <input
                    id="cat-slug"
                    value={categoryModal.form.slug}
                    onChange={(ev) => {
                      setCategorySlugEditedManually(true);
                      setCategoryModal({
                        ...categoryModal,
                        form: { ...categoryModal.form, slug: ev.target.value },
                      });
                    }}
                    onFocus={() => setCategorySlugEditedManually(true)}
                    required
                  />
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
                    Только строчные латинские буквы, цифры и дефисы
                  </p>
                </div>
                <div className="field">
                  <label htmlFor="cat-desc">Описание</label>
                  <textarea
                    id="cat-desc"
                    rows={2}
                    value={categoryModal.form.description}
                    onChange={(ev) =>
                      setCategoryModal({ ...categoryModal, form: { ...categoryModal.form, description: ev.target.value } })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="cat-color">Цвет (HEX)</label>
                  <input
                    id="cat-color"
                    value={categoryModal.form.color}
                    onChange={(ev) =>
                      setCategoryModal({ ...categoryModal, form: { ...categoryModal.form, color: ev.target.value } })
                    }
                    placeholder="#2D6A4F"
                  />
                  {/^#[0-9A-Fa-f]{6}$/.test(categoryModal.form.color.trim()) ? (
                    <div
                      style={{
                        marginTop: '0.4rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.85rem',
                        color: 'var(--muted)',
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 4,
                          backgroundColor: categoryModal.form.color.trim(),
                          border: '1px solid rgba(0,0,0,0.15)',
                        }}
                      />
                      Превью цвета
                    </div>
                  ) : null}
                </div>
                <div className="field">
                  <label className="modal-toggle">
                    <input
                      type="checkbox"
                      checked={categoryModal.form.isActive}
                      onChange={(ev) =>
                        setCategoryModal({ ...categoryModal, form: { ...categoryModal.form, isActive: ev.target.checked } })
                      }
                    />{' '}
                    Активна
                  </label>
                </div>
                <div className="modal-actions" style={{ marginTop: '1rem' }}>
                  <button type="button" onClick={() => setCategoryModal(null)}>
                    Отмена
                  </button>
                  <button type="submit" className="primary" disabled={savingCategory}>
                    {savingCategory ? 'Сохранение…' : 'Сохранить'}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="table-wrap sticky-head">
              <table style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Название</th>
                    <th style={{ width: '20%' }}>slug</th>
                    <th style={{ width: '22%' }}>Цвет</th>
                    <th style={{ width: '10%' }}>Порядок</th>
                    {canManageCategories ? <th style={{ width: '18%' }}>Действия</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {c.color ? (
                            <span
                              style={{
                                display: 'inline-block',
                                width: 16,
                                height: 16,
                                borderRadius: 4,
                                backgroundColor: c.color,
                                border: '1px solid rgba(0,0,0,0.1)',
                              }}
                            />
                          ) : null}
                          {c.name}
                        </div>
                      </td>
                      <td className="mono" style={{ wordBreak: 'break-word' }}>
                        {c.slug}
                      </td>
                      <td>
                        {c.color ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span
                              style={{
                                display: 'inline-block',
                                width: 14,
                                height: 14,
                                borderRadius: 4,
                                backgroundColor: c.color,
                                border: '1px solid rgba(0,0,0,0.12)',
                              }}
                            />
                            <span className="mono">{c.color.toUpperCase()}</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{c.sortOrder}</td>
                      {canManageCategories ? (
                        <td>
                          <div className="table-action-row">
                            <button
                              type="button"
                              className="action-icon-btn"
                              aria-label="Изменить направление"
                              title="Изменить"
                              onClick={() => {
                                setCategorySlugEditedManually(true);
                                setCategoryModal({
                                  mode: 'edit',
                                  id: c.id,
                                  form: categoryToForm(c),
                                });
                              }}
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              className="danger action-icon-btn"
                              aria-label="Удалить направление"
                              title="Удалить"
                              onClick={() => void removeCategory(c)}
                            >
                              <DeleteIcon />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
