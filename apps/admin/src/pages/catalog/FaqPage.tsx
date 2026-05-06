
import { FaqCategory } from '@srs/shared-types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { canMutateTenantCatalog } from '../../lib/roles';
import { FilterBar } from '../../ui/FilterBar';
import { useToast } from '../../ui/ToastContext';

import type { FormEvent } from 'react';

interface Row {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

interface FormState {
  category: FaqCategory;
  question: string;
  answer: string;
  isActive: boolean;
}

const categories = Object.values(FaqCategory);

function nextSortOrder(items: Array<{ sortOrder: number }>): number {
  const maxSortOrder = items.reduce((max, item) => Math.max(max, item.sortOrder), -10);
  return maxSortOrder + 10;
}

export function FaqPage() {
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
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const debouncedQuery = useDebouncedValue(searchQuery);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<Row[]>('/admin/catalog/faq-items');
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
        category: modal.form.category,
        question: modal.form.question.trim(),
        answer: modal.form.answer.trim(),
        ...(modal.mode === 'create' ? { sortOrder: nextSortOrder(rows) } : {}),
        isActive: modal.form.isActive,
      };
      if (modal.mode === 'create') {
        await apiRequest('/admin/catalog/faq-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (modal.id) {
        await apiRequest(`/admin/catalog/faq-items/${modal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setModal(null);
      await reload();
      showToast(modal.mode === 'create' ? 'Пункт FAQ создан' : 'Пункт FAQ обновлён', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
      showToast('Не удалось сохранить пункт FAQ', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, q: string) {
    if (!globalThis.confirm(`Удалить вопрос «${q.slice(0, 80)}»?`)) return;
    setError(null);
    try {
      await apiRequest(`/admin/catalog/faq-items/${id}`, { method: 'DELETE' });
      await reload();
      showToast('Пункт FAQ удалён', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
      showToast('Не удалось удалить пункт FAQ', 'error');
    }
  }

  const filteredRows = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.category.toLowerCase().includes(q) ||
        r.question.toLowerCase().includes(q) ||
        r.answer.toLowerCase().includes(q)
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
            FAQ
          </h1>
          {canMutate ? (
            <button
              type="button"
              className="primary"
              onClick={() =>
                setModal({
                  mode: 'create',
                  form: {
                    category: FaqCategory.Booking,
                    question: '',
                    answer: '',
                    isActive: true,
                  },
                })
              }
            >
              Новый пункт
            </button>
          ) : null}
        </div>
        <p className="page-subtitle">
          Частые вопросы и ответы, которые показываются в мобильном приложении в разделе помощи.
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
        placeholder="Категория, вопрос или ответ"
      />

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Загрузка…</p>
      ) : (
        <div className="table-wrap sticky-head">
          <table>
            <thead>
              <tr>
                <th>Категория</th>
                <th>Вопрос</th>
                <th>Порядок</th>
                <th>Активен</th>
                {canMutate ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.category}</td>
                    <td>{r.question}</td>
                    <td>{r.sortOrder}</td>
                    <td>{r.isActive ? 'да' : 'нет'}</td>
                    {canMutate ? (
                      <td>
                        <span className="inline-actions">
                          <button
                            type="button"
                            onClick={() =>
                              setModal({
                                mode: 'edit',
                                id: r.id,
                                form: {
                                  category: r.category,
                                  question: r.question,
                                  answer: r.answer,
                                  isActive: r.isActive,
                                },
                              })
                            }
                          >
                            Изменить
                          </button>
                          <button type="button" className="danger" onClick={() => void remove(r.id, r.question)}>
                            Удалить
                          </button>
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canMutate ? 5 : 4} style={{ color: 'var(--muted)' }}>
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
            style={{ width: 'min(640px, 100%)' }}
            role="dialog"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2>{modal.mode === 'create' ? 'Новый FAQ' : 'Редактирование FAQ'}</h2>
            <form onSubmit={(ev) => void submit(ev)}>
              <div className="field">
                <label htmlFor="faq-cat">Категория</label>
                <select
                  id="faq-cat"
                  value={modal.form.category}
                  onChange={(ev) =>
                    setModal({
                      ...modal,
                      form: { ...modal.form, category: ev.target.value as FaqCategory },
                    })
                  }
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="faq-q">Вопрос</label>
                <input
                  id="faq-q"
                  value={modal.form.question}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, question: ev.target.value } })
                  }
                  required
                  minLength={3}
                />
              </div>
              <div className="field">
                <label htmlFor="faq-a">Ответ</label>
                <textarea
                  id="faq-a"
                  rows={8}
                  value={modal.form.answer}
                  onChange={(ev) =>
                    setModal({ ...modal, form: { ...modal.form, answer: ev.target.value } })
                  }
                  required
                  minLength={3}
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
                  Активен
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
