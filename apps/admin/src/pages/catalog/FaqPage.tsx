
import { FaqCategory } from '@podocare/shared-types';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { canMutateTenantCatalog } from '../../lib/roles';

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
  sortOrder: string;
  isActive: boolean;
}

const categories = Object.values(FaqCategory);

export function FaqPage() {
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
      const sortOrder = Number(modal.form.sortOrder);
      const payload = {
        category: modal.form.category,
        question: modal.form.question.trim(),
        answer: modal.form.answer.trim(),
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
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
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
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
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
    }
  }

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ margin: 0, flex: 1 }}>FAQ</h1>
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
                  sortOrder: '0',
                  isActive: true,
                },
              })
            }
          >
            Новый пункт
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
                <th>Категория</th>
                <th>Вопрос</th>
                <th>Порядок</th>
                <th>Активен</th>
                {canMutate ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.category}</td>
                  <td>{r.question}</td>
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
                              category: r.category,
                              question: r.question,
                              answer: r.answer,
                              sortOrder: String(r.sortOrder),
                              isActive: r.isActive,
                            },
                          })
                        }
                      >
                        Изменить
                      </button>{' '}
                      <button type="button" className="danger" onClick={() => void remove(r.id, r.question)}>
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
                <label htmlFor="faq-sort">Порядок</label>
                <input
                  id="faq-sort"
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
