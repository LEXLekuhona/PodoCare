import { UserRole } from '@srs/shared-types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { slugify } from '../../lib/identifiers';
import { canManageStaff } from '../../lib/roles';
import { DeleteIcon } from '../../ui/DeleteIcon';
import EditIcon from '../../ui/EditIcon';

import type { FormEvent } from 'react';

interface NetworkRow {
  id: string;
  name: string;
  slug: string;
}

interface ProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  };
  imageUrls: string[];
  priceMinor: number;
  currency: string;
  stock: number | null;
  sortOrder: number;
  isActive: boolean;
  studioInventory: ProductStudioInventoryRow[];
}

interface ProductStudioInventoryRow {
  studioId: string;
  isAvailable: boolean;
  stock: number | null;
  priceMinor: number | null;
  studio: {
    id: string;
    name: string;
  };
}

interface StudioRow {
  id: string;
  networkId: string;
  name: string;
}

type ProductSortField = 'category' | 'name' | 'priceMinor';
type SortDirection = 'asc' | 'desc';

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

interface FormState {
  name: string;
  description: string;
  brand: string;
  categoryId: string;
  imageUrls: string;
  priceRubles: string;
  sortOrder: string;
  isActive: boolean;
  studioInventory: Record<string, { isAvailable: boolean; stock: string; priceRubles: string }>;
}

function emptyForm(): FormState {
  return {
    name: '',
    description: '',
    brand: '',
    categoryId: '',
    imageUrls: '',
    priceRubles: '0',
    sortOrder: '0',
    isActive: true,
    studioInventory: {},
  };
}

function rowToForm(row: ProductRow, studios: StudioRow[]): FormState {
  const inventoryByStudio = new Map(row.studioInventory.map((it) => [it.studioId, it]));
  return {
    name: row.name,
    description: row.description ?? '',
    brand: row.brand ?? '',
    categoryId: row.category.id,
    imageUrls: row.imageUrls.join('\n'),
    priceRubles: String(Math.round(row.priceMinor / 100)),
    sortOrder: String(row.sortOrder),
    isActive: row.isActive,
    studioInventory: Object.fromEntries(
      studios.map((studio) => {
        const inventory = inventoryByStudio.get(studio.id);
        return [
          studio.id,
          {
            isAvailable: inventory?.isAvailable ?? true,
            stock: inventory?.stock == null ? '' : String(inventory.stock),
            priceRubles: inventory?.priceMinor == null ? '' : String(Math.round(inventory.priceMinor / 100)),
          },
        ];
      }),
    ),
  };
}

function nextSortOrder(items: Array<{ sortOrder: number }>): number {
  const maxSortOrder = items.reduce((max, item) => Math.max(max, item.sortOrder), -10);
  return maxSortOrder + 10;
}

function emptyStudioInventory(studios: StudioRow[]): FormState['studioInventory'] {
  return Object.fromEntries(
    studios.map((studio) => [
      studio.id,
      {
        isAvailable: true,
        stock: '',
        priceRubles: '',
      },
    ]),
  );
}

export function ProductsPage() {
  const { user } = useAuth();
  const studioAdmin = user?.role === UserRole.StudioAdmin;
  const canMutate = user ? canManageStaff(user.role) : false;
  const [searchParams, setSearchParams] = useSearchParams();

  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [networkId, setNetworkId] = useState(() => searchParams.get('network') ?? '');
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; id?: string; form: FormState } | null>(
    null,
  );
  const [categoryModal, setCategoryModal] = useState<{
    mode: 'create' | 'edit';
    id?: string;
    form: { slug: string; name: string; isActive: boolean };
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [categorySlugEditedManually, setCategorySlugEditedManually] = useState(false);
  const [categoryFilterId, setCategoryFilterId] = useState<string>(
    () => searchParams.get('category') ?? 'all',
  );
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [sortField, setSortField] = useState<ProductSortField>('category');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const reloadNetworks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<NetworkRow[]>('/admin/catalog/networks');
      setNetworks(data);
      if (data.length > 0) {
        setNetworkId((prev) => {
          if (prev && data.some((n) => n.id === prev)) {
            return prev;
          }
          return data[0]!.id;
        });
      } else {
        setNetworkId('');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки сетей');
    } finally {
      setLoading(false);
    }
  }, [studioAdmin]);

  useEffect(() => {
    void reloadNetworks();
  }, [reloadNetworks]);

  const reloadProducts = useCallback(async () => {
    if (!networkId) {
      setRows([]);
      setCategories([]);
      setStudios([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [goods, cats, studioRows] = await Promise.all([
        apiRequest<ProductRow[]>(`/admin/catalog/networks/${networkId}/physical-goods`),
        apiRequest<CategoryRow[]>(`/admin/catalog/networks/${networkId}/physical-good-categories`),
        apiRequest<StudioRow[]>(`/admin/catalog/studios?networkId=${networkId}`),
      ]);
      setRows(goods);
      setCategories(cats);
      setStudios(studioRows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки товаров');
      setRows([]);
      setCategories([]);
      setStudios([]);
    } finally {
      setLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    void reloadProducts();
  }, [reloadProducts]);

  const networkLabel = useMemo(() => {
    const row = networks.find((n) => n.id === networkId);
    return row ? `${row.name} (${row.slug})` : '';
  }, [networks, networkId]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      const byCategory = categoryFilterId === 'all' || r.category.id === categoryFilterId;
      if (!byCategory) return false;
      if (q === '') return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.brand ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, categoryFilterId, searchQuery]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let left: string | number = '';
      let right: string | number = '';
      if (sortField === 'category') {
        left = a.category.name;
        right = b.category.name;
      } else if (sortField === 'name') {
        left = a.name;
        right = b.name;
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
  }, [filteredRows, sortField, sortDirection]);

  function toggleSort(field: ProductSortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDirection('asc');
  }

  function sortMark(field: ProductSortField): string {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  useEffect(() => {
    const next = new URLSearchParams();
    const network = networkId.trim();
    const q = searchQuery.trim();
    if (network) next.set('network', network);
    if (categoryFilterId !== 'all') next.set('category', categoryFilterId);
    if (q) next.set('q', q);
    setSearchParams(next, { replace: true });
  }, [networkId, categoryFilterId, searchQuery, setSearchParams]);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!modal || !networkId) return;
    const priceRubles = Number(modal.form.priceRubles);
    if (!Number.isInteger(priceRubles) || priceRubles < 0) {
      setError('Цена: целое число рублей >= 0');
      return;
    }
    if (modal.form.categoryId.trim() === '') {
      setError('Категория обязательна');
      return;
    }
    const sortOrder = Number(modal.form.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setError('Порядок: целое число >= 0');
      return;
    }

    const imageUrls = modal.form.imageUrls
      .split('\n')
      .map((x) => x.trim())
      .filter((x) => x.length > 0);

    const studioInventory: Array<{
      studioId: string;
      isAvailable: boolean;
      stock: number | null;
      priceRubles: number | null;
    }> = [];
    for (const studio of studios) {
      const item = modal.form.studioInventory[studio.id] ?? { isAvailable: true, stock: '', priceRubles: '' };
      const stock = item.stock.trim() === '' ? null : Number(item.stock);
      const studioPriceRubles = item.priceRubles.trim() === '' ? null : Number(item.priceRubles);
      if (stock != null && (!Number.isInteger(stock) || stock < 0)) {
        setError(`Остаток для студии «${studio.name}»: целое число >= 0`);
        return;
      }
      if (studioPriceRubles != null && (!Number.isInteger(studioPriceRubles) || studioPriceRubles < 0)) {
        setError(`Цена для студии «${studio.name}»: целое число >= 0`);
        return;
      }
      studioInventory.push({
        studioId: studio.id,
        isAvailable: item.isAvailable,
        stock,
        priceRubles: studioPriceRubles,
      });
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: modal.form.name.trim(),
        description: modal.form.description.trim() || undefined,
        brand: modal.form.brand.trim() || undefined,
        categoryId: modal.form.categoryId,
        imageUrls,
        priceRubles,
        sortOrder,
        isActive: modal.form.isActive,
        studioInventory,
      };

      if (modal.mode === 'create') {
        await apiRequest(`/admin/catalog/networks/${networkId}/physical-goods`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (modal.id) {
        await apiRequest(`/admin/catalog/networks/${networkId}/physical-goods/${modal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setModal(null);
      await reloadProducts();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: ProductRow) {
    if (!networkId) return;
    if (!globalThis.confirm(`Удалить товар «${row.name}»?`)) return;
    setError(null);
    try {
      await apiRequest(`/admin/catalog/networks/${networkId}/physical-goods/${row.id}`, {
        method: 'DELETE',
      });
      await reloadProducts();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
    }
  }

  async function uploadProductImage(file: File) {
    if (!modal || !networkId) return;
    setUploadingImage(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiRequest<{ url: string }>(
        `/admin/catalog/networks/${networkId}/physical-goods/images`,
        {
          method: 'POST',
          body: formData,
        },
      );
      setModal((prev) => {
        if (!prev) return prev;
        const existing = prev.form.imageUrls.trim();
        return {
          ...prev,
          form: {
            ...prev.form,
            imageUrls: existing ? `${existing}\n${res.url}` : res.url,
          },
        };
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка загрузки изображения');
    } finally {
      setUploadingImage(false);
    }
  }

  async function submitCategory(ev: FormEvent) {
    ev.preventDefault();
    if (!networkId || !categoryModal) return;
    const payload = {
      slug: categoryModal.form.slug.trim(),
      name: categoryModal.form.name.trim(),
      ...(categoryModal.mode === 'create' ? { sortOrder: nextSortOrder(categories) } : {}),
      isActive: categoryModal.form.isActive,
    };
    setSaving(true);
    setError(null);
    try {
      if (categoryModal.mode === 'create') {
        await apiRequest(`/admin/catalog/networks/${networkId}/physical-good-categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (categoryModal.id) {
        await apiRequest(
          `/admin/catalog/networks/${networkId}/physical-good-categories/${categoryModal.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
      }
      setCategoryModal(null);
      await reloadProducts();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения категории');
    } finally {
      setSaving(false);
    }
  }

  async function removeCategory(row: CategoryRow) {
    if (!networkId) return;
    if (!globalThis.confirm(`Удалить категорию «${row.name}»?`)) return;
    setError(null);
    try {
      await apiRequest(`/admin/catalog/networks/${networkId}/physical-good-categories/${row.id}`, {
        method: 'DELETE',
      });
      await reloadProducts();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления категории');
    }
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <h1 className="page-title" style={{ flex: 1 }}>
            Товары
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {canMutate && networkId ? (
              <button
                type="button"
                onClick={() => {
                  setCategorySlugEditedManually(false);
                  setCategoryModal({
                    mode: 'create',
                    form: { slug: '', name: '', isActive: true },
                  });
                }}
              >
                Новая категория
              </button>
            ) : null}
            {canMutate && networkId ? (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setModal({
                    mode: 'create',
                    form: {
                      ...emptyForm(),
                      categoryId: categories.find((c) => c.isActive)?.id ?? '',
                      sortOrder: String(nextSortOrder(rows)),
                      studioInventory: emptyStudioInventory(studios),
                    },
                  });
                }}
              >
                Новый товар
              </button>
            ) : null}
          </div>
        </div>
        <p className="page-subtitle">Категории ведутся отдельно как справочник и используются для фильтрации.</p>
      </div>

      <div className="surface-card">
        <div className="field" style={{ maxWidth: 420, marginBottom: 0 }}>
        <label htmlFor="goods-network">Сеть</label>
        <select
          id="goods-network"
          value={networkId}
          disabled={studioAdmin || networks.length === 0}
          onChange={(ev) => setNetworkId(ev.target.value)}
        >
          {networks.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name} ({n.slug})
            </option>
          ))}
        </select>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {!networkId ? (
        <p style={{ color: 'var(--muted)' }}>Выберите сеть, чтобы увидеть товары.</p>
      ) : loading ? (
        <p style={{ color: 'var(--muted)' }}>Загрузка…</p>
      ) : (
        <>
          <div className="table-wrap sticky-head" style={{ marginBottom: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Категория</th>
                  <th>Slug</th>
                  <th>Порядок</th>
                  <th>Активна</th>
                  {canMutate ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {categories.length > 0 ? (
                  categories.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td className="mono">{c.slug}</td>
                      <td>{c.sortOrder}</td>
                      <td>{c.isActive ? 'да' : 'нет'}</td>
                      {canMutate ? (
                        <td>
                          <div className="table-action-row">
                          <button
                            type="button"
                            className="action-icon-btn"
                            aria-label="Изменить категорию"
                            title="Изменить"
                            onClick={() => {
                              setCategorySlugEditedManually(true);
                              setCategoryModal({
                                mode: 'edit',
                                id: c.id,
                                form: {
                                  slug: c.slug,
                                  name: c.name,
                                  isActive: c.isActive,
                                },
                              });
                            }}
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="danger action-icon-btn"
                            aria-label="Удалить категорию"
                            title="Удалить"
                            onClick={() => void removeCategory(c)}
                          >
                            <DeleteIcon />
                          </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={canMutate ? 5 : 4} style={{ color: 'var(--muted)' }}>
                      Категорий пока нет.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="table-wrap sticky-head">
            <div style={{ padding: '0.75rem 0.75rem 0.25rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 12 }}>
                <div className="field" style={{ maxWidth: 360, marginBottom: 0 }}>
                  <label htmlFor="products-category-filter">Фильтр по категории</label>
                  <select
                    id="products-category-filter"
                    value={categoryFilterId}
                    onChange={(ev) => setCategoryFilterId(ev.target.value)}
                  >
                    <option value="all">Все категории</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ maxWidth: 360, marginBottom: 0 }}>
                  <label htmlFor="products-search">Поиск</label>
                  <input
                    id="products-search"
                    placeholder="Название, SKU, slug, бренд"
                    value={searchQuery}
                    onChange={(ev) => setSearchQuery(ev.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilterId('all');
                    setSearchQuery('');
                  }}
                  disabled={categoryFilterId === 'all' && searchQuery.trim() === ''}
                >
                  Сбросить
                </button>
                <span className="badge">
                  Найдено: {filteredRows.length}/{rows.length}
                </span>
              </div>
            </div>
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
                      Категория <span>{sortMark('category')}</span>
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
                  {canMutate ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {sortedRows.length > 0 ? (
                  sortedRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.category.name}</td>
                      <td>{r.name}</td>
                      <td>
                        {(r.priceMinor / 100).toLocaleString('ru-RU')} {r.currency}
                      </td>
                      {canMutate ? (
                        <td>
                          <div className="table-action-row">
                          <button
                            type="button"
                            className="action-icon-btn"
                            aria-label="Изменить товар"
                            title="Изменить"
                            onClick={() => {
                              setModal({ mode: 'edit', id: r.id, form: rowToForm(r, studios) });
                            }}
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="danger action-icon-btn"
                            aria-label="Удалить товар"
                            title="Удалить"
                            onClick={() => void remove(r)}
                          >
                            <DeleteIcon />
                          </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={canMutate ? 4 : 3} style={{ color: 'var(--muted)' }}>
                      Ничего не найдено. Попробуйте изменить фильтры.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {categoryModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setCategoryModal(null)}>
          <div className="modal" role="dialog" onClick={(ev) => ev.stopPropagation()}>
            <h2>{categoryModal.mode === 'create' ? 'Новая категория' : 'Редактирование категории'}</h2>
            <form onSubmit={(ev) => void submitCategory(ev)}>
              <div className="field">
                <label htmlFor="cat-slug">Slug</label>
                <input
                  id="cat-slug"
                  value={categoryModal.form.slug}
                  onChange={(ev) =>
                    setCategoryModal({
                      ...categoryModal,
                      form: { ...categoryModal.form, slug: ev.target.value },
                    })
                  }
                  onFocus={() => setCategorySlugEditedManually(true)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="cat-name">Название</label>
                <input
                  id="cat-name"
                  value={categoryModal.form.name}
                  onChange={(ev) =>
                    setCategoryModal((prev) => {
                      if (!prev) return prev;
                      const nextName = ev.target.value;
                      return {
                        ...prev,
                        form: {
                          ...prev.form,
                          name: nextName,
                          slug:
                            !categorySlugEditedManually || prev.form.slug.trim() === ''
                              ? slugify(nextName)
                              : prev.form.slug,
                        },
                      };
                    })
                  }
                  required
                />
              </div>
              <div className="field">
                <label className="modal-toggle">
                  <input
                    type="checkbox"
                    checked={categoryModal.form.isActive}
                    onChange={(ev) =>
                      setCategoryModal({
                        ...categoryModal,
                        form: { ...categoryModal.form, isActive: ev.target.checked },
                      })
                    }
                  />{' '}
                  Активна
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setCategoryModal(null)}>
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

      {modal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setModal(null)}>
          <div
            className="modal"
            style={{ width: 'min(640px, 100%)' }}
            role="dialog"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2>{modal.mode === 'create' ? 'Новый товар' : 'Редактирование товара'}</h2>
            {networkLabel ? (
              <p style={{ color: 'var(--muted)', marginTop: 0, fontSize: '0.9rem' }}>{networkLabel}</p>
            ) : null}
            <form onSubmit={(ev) => void submit(ev)}>
              <p style={{ color: 'var(--muted)', marginTop: 0, fontSize: '0.86rem' }}>
                SKU и slug формируются автоматически из названия товара.
              </p>
              <div className="field">
                <label htmlFor="good-name">Название</label>
                <input
                  id="good-name"
                  value={modal.form.name}
                  onChange={(ev) => setModal({ ...modal, form: { ...modal.form, name: ev.target.value } })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="good-category">Категория</label>
                <select
                  id="good-category"
                  value={modal.form.categoryId}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, categoryId: ev.target.value } })
                  }
                  required
                >
                  <option value="">— выберите категорию —</option>
                  {categories
                    .filter((c) => c.isActive || c.id === modal.form.categoryId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="good-brand">Бренд</label>
                <input
                  id="good-brand"
                  value={modal.form.brand}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, brand: ev.target.value } })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="good-desc">Описание</label>
                <textarea
                  id="good-desc"
                  rows={3}
                  value={modal.form.description}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, description: ev.target.value } })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="good-images">URL изображений (по одному в строке)</label>
                <textarea
                  id="good-images"
                  rows={3}
                  value={modal.form.imageUrls}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, imageUrls: ev.target.value } })
                  }
                />
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingImage}
                  onChange={(ev) => {
                    const file = ev.target.files?.[0];
                    ev.currentTarget.value = '';
                    if (file) void uploadProductImage(file);
                  }}
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.35rem 0 0' }}>
                  Можно вставить URL вручную или загрузить файл. После загрузки ссылка добавится в список.
                </p>
              </div>
              <div className="field">
                <label htmlFor="good-price">Цена (₽, целое)</label>
                <input
                  id="good-price"
                  title="Стоимость в рублях. На витрине показывается как обычная цена."
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
                <label htmlFor="good-sort-order">Порядок сортировки</label>
                <input
                  id="good-sort-order"
                  type="number"
                  min={0}
                  step={1}
                  value={modal.form.sortOrder}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, sortOrder: ev.target.value } })
                  }
                  required
                />
              </div>
              <div className="field">
                <label>Наличие и остатки по студиям</label>
                <div style={{ display: 'grid', gap: 10 }}>
                  {studios.length > 0 ? (
                    studios.map((studio) => {
                      const item = modal.form.studioInventory[studio.id] ?? {
                        isAvailable: true,
                        stock: '',
                        priceRubles: '',
                      };
                      return (
                        <div
                          key={studio.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(160px, 1.4fr) minmax(110px, 0.8fr) minmax(120px, 0.8fr)',
                            gap: 8,
                            alignItems: 'center',
                          }}
                        >
                          <label className="modal-toggle" style={{ margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={item.isAvailable}
                              onChange={(ev) =>
                                setModal({
                                  ...modal,
                                  form: {
                                    ...modal.form,
                                    studioInventory: {
                                      ...modal.form.studioInventory,
                                      [studio.id]: { ...item, isAvailable: ev.target.checked },
                                    },
                                  },
                                })
                              }
                            />{' '}
                            {studio.name}
                          </label>
                          <input
                            aria-label={`Остаток ${studio.name}`}
                            type="number"
                            min={0}
                            step={1}
                            placeholder="Остаток"
                            value={item.stock}
                            onChange={(ev) =>
                              setModal({
                                ...modal,
                                form: {
                                  ...modal.form,
                                  studioInventory: {
                                    ...modal.form.studioInventory,
                                    [studio.id]: { ...item, stock: ev.target.value },
                                  },
                                },
                              })
                            }
                          />
                          <input
                            aria-label={`Цена ${studio.name}`}
                            type="number"
                            min={0}
                            step={1}
                            placeholder="Цена студии"
                            value={item.priceRubles}
                            onChange={(ev) =>
                              setModal({
                                ...modal,
                                form: {
                                  ...modal.form,
                                  studioInventory: {
                                    ...modal.form.studioInventory,
                                    [studio.id]: { ...item, priceRubles: ev.target.value },
                                  },
                                },
                              })
                            }
                          />
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ color: 'var(--muted)', margin: 0 }}>В сети пока нет студий.</p>
                  )}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.35rem 0 0' }}>
                  Пустая цена студии означает использование базовой цены товара. Пустой остаток — не отслеживать остаток.
                </p>
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
                  Активен (виден в приложении)
                </label>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.35rem 0 0' }}>
                  Если выключить, товар останется в базе, но скроется из мобильного приложения.
                </p>
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
