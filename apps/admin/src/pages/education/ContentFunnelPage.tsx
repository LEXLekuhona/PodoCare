import { ContentAudience, ContentCtaTarget, ContentFormat, UserRole } from '@srs/shared-types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { canManageStaff } from '../../lib/roles';
import { useToast } from '../../ui/ToastContext';

import type { FormEvent } from 'react';

type PublishStatus = 'draft' | 'published';

interface NetworkRow {
  id: string;
  name: string;
  slug: string;
}

interface SeriesRow {
  id: string;
  networkId: string;
  title: string;
  subtitle: string | null;
  audience: ContentAudience;
  isPublished: boolean;
  priceMinor: number;
}

interface CtaRow {
  id: string;
  target: ContentCtaTarget;
  label: string;
  subtitle: string | null;
  targetExternalUrl: string | null;
  isActive: boolean;
}

interface ItemRow {
  id: string;
  networkId: string;
  seriesId: string;
  title: string;
  format: ContentFormat;
  audience: ContentAudience;
  isPublished: boolean;
  isFreePreview: boolean;
  ctas?: CtaRow[];
}

interface SeriesFormState {
  title: string;
  subtitle: string;
  description: string;
  audience: ContentAudience;
  priceRubles: string;
  status: PublishStatus;
}

interface ItemFormState {
  title: string;
  description: string;
  format: ContentFormat;
  audience: ContentAudience;
  bodyJson: string;
  isFreePreview: boolean;
  status: PublishStatus;
}

interface CtaFormState {
  target: ContentCtaTarget;
  label: string;
  subtitle: string;
  targetExternalUrl: string;
}

function emptySeriesForm(): SeriesFormState {
  return {
    title: '',
    subtitle: '',
    description: '',
    audience: ContentAudience.Client,
    priceRubles: '0',
    status: 'draft',
  };
}

function emptyItemForm(): ItemFormState {
  return {
    title: '',
    description: '',
    format: ContentFormat.Article,
    audience: ContentAudience.Client,
    bodyJson: JSON.stringify({ markdown: '' }, null, 2),
    isFreePreview: true,
    status: 'draft',
  };
}

function emptyCtaForm(): CtaFormState {
  return {
    target: ContentCtaTarget.ExternalUrl,
    label: '',
    subtitle: '',
    targetExternalUrl: '',
  };
}

function audienceLabel(audience: ContentAudience): string {
  if (audience === ContentAudience.Client) return 'Клиенты';
  if (audience === ContentAudience.Specialist) return 'Специалисты';
  return 'Все';
}

export function ContentFunnelPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canMutate = user ? canManageStaff(user.role) : false;
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [networkId, setNetworkId] = useState('');
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [seriesId, setSeriesId] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seriesModal, setSeriesModal] = useState<{ mode: 'create' | 'edit'; id?: string; form: SeriesFormState } | null>(null);
  const [itemModal, setItemModal] = useState<{ mode: 'create' | 'edit'; id?: string; form: ItemFormState } | null>(null);
  const [ctaModal, setCtaModal] = useState<{ itemId: string; ctaId?: string; form: CtaFormState } | null>(null);

  const isStudioAdmin = user?.role === UserRole.StudioAdmin;

  const loadNetworks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<NetworkRow[]>('/admin/catalog/networks');
      setNetworks(data);
      if (data.length > 0) {
        setNetworkId((prev) => (prev && data.some((x) => x.id === prev) ? prev : data[0]!.id));
      } else {
        setNetworkId('');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить сети');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSeries = useCallback(async () => {
    if (!networkId) {
      setSeries([]);
      setSeriesId('');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ items: SeriesRow[] }>(
        `/content/series?networkId=${encodeURIComponent(networkId)}&take=100`,
      );
      setSeries(data.items);
      setSeriesId((prev) => (prev && data.items.some((x) => x.id === prev) ? prev : (data.items[0]?.id ?? '')));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить серии');
      setSeries([]);
      setSeriesId('');
    } finally {
      setLoading(false);
    }
  }, [networkId]);

  const loadItems = useCallback(async () => {
    if (!seriesId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ items: ItemRow[] }>(
        `/admin/education/items?seriesId=${encodeURIComponent(seriesId)}&take=200`,
      );
      setItems(data.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить элементы');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  useEffect(() => {
    void loadNetworks();
  }, [loadNetworks]);

  useEffect(() => {
    void loadSeries();
  }, [loadSeries]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const selectedSeries = useMemo(() => series.find((x) => x.id === seriesId) ?? null, [series, seriesId]);

  async function submitSeries(ev: FormEvent) {
    ev.preventDefault();
    if (!seriesModal || !networkId) return;
    const priceRubles = Number(seriesModal.form.priceRubles);
    if (!Number.isInteger(priceRubles) || priceRubles < 0) {
      setError('Цена серии должна быть целым числом рублей >= 0');
      return;
    }
    const payload = {
      networkId,
      title: seriesModal.form.title.trim(),
      subtitle: seriesModal.form.subtitle.trim() || undefined,
      description: seriesModal.form.description.trim() || undefined,
      audience: seriesModal.form.audience,
      priceMinor: priceRubles * 100,
      status: seriesModal.form.status,
    };
    setSaving(true);
    setError(null);
    try {
      if (seriesModal.mode === 'create') {
        await apiRequest('/content/series', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (seriesModal.id) {
        await apiRequest(`/content/series/${seriesModal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setSeriesModal(null);
      await loadSeries();
      showToast('Серия сохранена', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить серию');
      showToast('Ошибка сохранения серии', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function submitItem(ev: FormEvent) {
    ev.preventDefault();
    if (!itemModal || !networkId || !seriesId) return;
    let body: unknown;
    try {
      body = JSON.parse(itemModal.form.bodyJson);
    } catch {
      setError('Поле body должно быть валидным JSON');
      return;
    }
    const payload = {
      networkId,
      seriesId,
      title: itemModal.form.title.trim(),
      description: itemModal.form.description.trim() || undefined,
      format: itemModal.form.format,
      audience: itemModal.form.audience,
      body,
      isFreePreview: itemModal.form.isFreePreview,
      status: itemModal.form.status,
    };
    setSaving(true);
    setError(null);
    try {
      if (itemModal.mode === 'create') {
        await apiRequest('/content/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (itemModal.id) {
        await apiRequest(`/content/items/${itemModal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setItemModal(null);
      await loadItems();
      showToast('Элемент контента сохранён', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить элемент');
      showToast('Ошибка сохранения элемента', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function publishItem(id: string) {
    setError(null);
    try {
      await apiRequest(`/content/items/${id}/publish`, { method: 'POST' });
      await loadItems();
      showToast('Элемент опубликован', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось опубликовать элемент');
      showToast('Ошибка публикации', 'error');
    }
  }

  async function submitCta(ev: FormEvent) {
    ev.preventDefault();
    if (!ctaModal) return;
    const payload = {
      target: ctaModal.form.target,
      label: ctaModal.form.label.trim(),
      subtitle: ctaModal.form.subtitle.trim() || undefined,
      targetExternalUrl:
        ctaModal.form.target === ContentCtaTarget.ExternalUrl
          ? ctaModal.form.targetExternalUrl.trim()
          : undefined,
    };
    if (payload.target === ContentCtaTarget.ExternalUrl && !payload.targetExternalUrl) {
      setError('Для EXTERNAL_URL укажите ссылку');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (ctaModal.ctaId) {
        await apiRequest(`/content/items/${ctaModal.itemId}/cta/${ctaModal.ctaId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(`/content/items/${ctaModal.itemId}/cta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setCtaModal(null);
      await loadItems();
      showToast('CTA сохранён', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить CTA');
      showToast('Ошибка сохранения CTA', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <h1 className="page-title" style={{ flex: 1 }}>
            Контент-воронка
          </h1>
          {canMutate ? (
            <>
              <button type="button" onClick={() => setSeriesModal({ mode: 'create', form: emptySeriesForm() })}>
                Новая серия
              </button>
              <button
                type="button"
                className="primary"
                disabled={!seriesId}
                onClick={() => setItemModal({ mode: 'create', form: emptyItemForm() })}
              >
                Новый элемент
              </button>
            </>
          ) : null}
        </div>
        <p className="page-subtitle">
          Управление сериями, материалами, CTA и публикацией с push для релевантной аудитории.
        </p>
      </div>

      <div className="surface-card">
        <div className="field" style={{ maxWidth: 420, marginBottom: 0 }}>
          <label htmlFor="funnel-network">Сеть</label>
          <select
            id="funnel-network"
            value={networkId}
            disabled={isStudioAdmin || networks.length === 0}
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
      {loading ? <p style={{ color: 'var(--muted)' }}>Загрузка…</p> : null}

      <div className="table-wrap sticky-head" style={{ marginBottom: '1rem' }}>
        <table>
          <thead>
            <tr>
              <th>Серия</th>
              <th>Аудитория</th>
              <th>Цена</th>
              <th>Статус</th>
              {canMutate ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {series.length > 0 ? (
              series.map((row) => (
                <tr key={row.id} style={row.id === seriesId ? { backgroundColor: 'rgba(45,106,79,0.08)' } : undefined}>
                  <td>
                    <button
                      type="button"
                      style={{ all: 'unset', cursor: 'pointer', color: 'var(--primary)' }}
                      onClick={() => setSeriesId(row.id)}
                    >
                      {row.title}
                    </button>
                  </td>
                  <td>{audienceLabel(row.audience)}</td>
                  <td>{(row.priceMinor / 100).toLocaleString('ru-RU')} ₽</td>
                  <td>{row.isPublished ? 'published' : 'draft'}</td>
                  {canMutate ? (
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          setSeriesModal({
                            mode: 'edit',
                            id: row.id,
                            form: {
                              title: row.title,
                              subtitle: row.subtitle ?? '',
                              description: '',
                              audience: row.audience,
                              priceRubles: String(Math.round(row.priceMinor / 100)),
                              status: row.isPublished ? 'published' : 'draft',
                            },
                          })
                        }
                      >
                        Изменить
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={canMutate ? 5 : 4} style={{ color: 'var(--muted)' }}>
                  Серий пока нет.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="surface-card" style={{ marginBottom: '1rem' }}>
        <strong>Выбрана серия:</strong> {selectedSeries ? selectedSeries.title : '—'}
      </div>

      <div className="table-wrap sticky-head">
        <table>
          <thead>
            <tr>
              <th>Элемент</th>
              <th>Формат</th>
              <th>Аудитория</th>
              <th>Статус</th>
              <th>CTA</th>
              {canMutate ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.format}</td>
                  <td>{audienceLabel(row.audience)}</td>
                  <td>{row.isPublished ? 'published' : 'draft'}</td>
                  <td>{row.ctas?.[0]?.label ?? '—'}</td>
                  {canMutate ? (
                    <td>
                      <span className="inline-actions">
                        <button
                          type="button"
                          onClick={() =>
                            setItemModal({
                              mode: 'edit',
                              id: row.id,
                              form: {
                                title: row.title,
                                description: '',
                                format: row.format,
                                audience: row.audience,
                                bodyJson: JSON.stringify({ markdown: '' }, null, 2),
                                isFreePreview: row.isFreePreview,
                                status: row.isPublished ? 'published' : 'draft',
                              },
                            })
                          }
                        >
                          Изменить
                        </button>
                        {!row.isPublished ? (
                          <button type="button" className="primary" onClick={() => void publishItem(row.id)}>
                            Publish
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            setCtaModal({
                              itemId: row.id,
                              ctaId: row.ctas?.[0]?.id,
                              form: row.ctas?.[0]
                                ? {
                                    target: row.ctas[0].target,
                                    label: row.ctas[0].label,
                                    subtitle: row.ctas[0].subtitle ?? '',
                                    targetExternalUrl: row.ctas[0].targetExternalUrl ?? '',
                                  }
                                : emptyCtaForm(),
                            })
                          }
                        >
                          CTA
                        </button>
                      </span>
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={canMutate ? 6 : 5} style={{ color: 'var(--muted)' }}>
                  Выберите серию и добавьте первый элемент.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {seriesModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSeriesModal(null)}>
          <div className="modal" role="dialog" onClick={(ev) => ev.stopPropagation()}>
            <h2>{seriesModal.mode === 'create' ? 'Новая серия' : 'Редактирование серии'}</h2>
            <form onSubmit={(ev) => void submitSeries(ev)}>
              <div className="field">
                <label htmlFor="series-title">Название</label>
                <input
                  id="series-title"
                  value={seriesModal.form.title}
                  onChange={(ev) =>
                    setSeriesModal({ ...seriesModal, form: { ...seriesModal.form, title: ev.target.value } })
                  }
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="series-subtitle">Подзаголовок</label>
                <input
                  id="series-subtitle"
                  value={seriesModal.form.subtitle}
                  onChange={(ev) =>
                    setSeriesModal({ ...seriesModal, form: { ...seriesModal.form, subtitle: ev.target.value } })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="series-audience">Аудитория</label>
                <select
                  id="series-audience"
                  value={seriesModal.form.audience}
                  onChange={(ev) =>
                    setSeriesModal({
                      ...seriesModal,
                      form: { ...seriesModal.form, audience: ev.target.value as ContentAudience },
                    })
                  }
                >
                  <option value={ContentAudience.Client}>Клиенты</option>
                  <option value={ContentAudience.Specialist}>Специалисты</option>
                  <option value={ContentAudience.Everyone}>Все</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="series-price">Цена (₽)</label>
                <input
                  id="series-price"
                  type="number"
                  min={0}
                  step={1}
                  value={seriesModal.form.priceRubles}
                  onChange={(ev) =>
                    setSeriesModal({ ...seriesModal, form: { ...seriesModal.form, priceRubles: ev.target.value } })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="series-status">Статус</label>
                <select
                  id="series-status"
                  value={seriesModal.form.status}
                  onChange={(ev) =>
                    setSeriesModal({
                      ...seriesModal,
                      form: { ...seriesModal.form, status: ev.target.value as PublishStatus },
                    })
                  }
                >
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setSeriesModal(null)}>
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

      {itemModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setItemModal(null)}>
          <div className="modal" role="dialog" onClick={(ev) => ev.stopPropagation()}>
            <h2>{itemModal.mode === 'create' ? 'Новый элемент' : 'Редактирование элемента'}</h2>
            <form onSubmit={(ev) => void submitItem(ev)}>
              <div className="field">
                <label htmlFor="item-title">Название</label>
                <input
                  id="item-title"
                  value={itemModal.form.title}
                  onChange={(ev) => setItemModal({ ...itemModal, form: { ...itemModal.form, title: ev.target.value } })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="item-format">Формат</label>
                <select
                  id="item-format"
                  value={itemModal.form.format}
                  onChange={(ev) =>
                    setItemModal({ ...itemModal, form: { ...itemModal.form, format: ev.target.value as ContentFormat } })
                  }
                >
                  <option value={ContentFormat.Article}>ARTICLE</option>
                  <option value={ContentFormat.Video}>VIDEO</option>
                  <option value={ContentFormat.Audio}>AUDIO</option>
                  <option value={ContentFormat.Webinar}>WEBINAR</option>
                  <option value={ContentFormat.Quiz}>QUIZ</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="item-audience">Аудитория</label>
                <select
                  id="item-audience"
                  value={itemModal.form.audience}
                  onChange={(ev) =>
                    setItemModal({
                      ...itemModal,
                      form: { ...itemModal.form, audience: ev.target.value as ContentAudience },
                    })
                  }
                >
                  <option value={ContentAudience.Client}>Клиенты</option>
                  <option value={ContentAudience.Specialist}>Специалисты</option>
                  <option value={ContentAudience.Everyone}>Все</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="item-body">body (JSON)</label>
                <textarea
                  id="item-body"
                  rows={8}
                  className="mono"
                  value={itemModal.form.bodyJson}
                  onChange={(ev) => setItemModal({ ...itemModal, form: { ...itemModal.form, bodyJson: ev.target.value } })}
                />
              </div>
              <div className="field">
                <label className="modal-toggle">
                  <input
                    type="checkbox"
                    checked={itemModal.form.isFreePreview}
                    onChange={(ev) =>
                      setItemModal({ ...itemModal, form: { ...itemModal.form, isFreePreview: ev.target.checked } })
                    }
                  />{' '}
                  Бесплатный preview
                </label>
              </div>
              <div className="field">
                <label htmlFor="item-status">Статус</label>
                <select
                  id="item-status"
                  value={itemModal.form.status}
                  onChange={(ev) =>
                    setItemModal({
                      ...itemModal,
                      form: { ...itemModal.form, status: ev.target.value as PublishStatus },
                    })
                  }
                >
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setItemModal(null)}>
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

      {ctaModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setCtaModal(null)}>
          <div className="modal" role="dialog" onClick={(ev) => ev.stopPropagation()}>
            <h2>CTA элемента</h2>
            <form onSubmit={(ev) => void submitCta(ev)}>
              <div className="field">
                <label htmlFor="cta-target">Тип CTA</label>
                <select
                  id="cta-target"
                  value={ctaModal.form.target}
                  onChange={(ev) =>
                    setCtaModal({ ...ctaModal, form: { ...ctaModal.form, target: ev.target.value as ContentCtaTarget } })
                  }
                >
                  <option value={ContentCtaTarget.ExternalUrl}>EXTERNAL_URL</option>
                  <option value={ContentCtaTarget.Program}>PROGRAM</option>
                  <option value={ContentCtaTarget.ContentSeries}>CONTENT_SERIES</option>
                  <option value={ContentCtaTarget.Service}>SERVICE</option>
                  <option value={ContentCtaTarget.PhysicalGood}>PHYSICAL_GOOD</option>
                  <option value={ContentCtaTarget.Quiz}>QUIZ</option>
                  <option value={ContentCtaTarget.ProgramInquiry}>PROGRAM_INQUIRY</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="cta-label">Текст кнопки</label>
                <input
                  id="cta-label"
                  value={ctaModal.form.label}
                  onChange={(ev) => setCtaModal({ ...ctaModal, form: { ...ctaModal.form, label: ev.target.value } })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="cta-subtitle">Подзаголовок</label>
                <input
                  id="cta-subtitle"
                  value={ctaModal.form.subtitle}
                  onChange={(ev) => setCtaModal({ ...ctaModal, form: { ...ctaModal.form, subtitle: ev.target.value } })}
                />
              </div>
              {ctaModal.form.target === ContentCtaTarget.ExternalUrl ? (
                <div className="field">
                  <label htmlFor="cta-url">Ссылка</label>
                  <input
                    id="cta-url"
                    type="url"
                    value={ctaModal.form.targetExternalUrl}
                    onChange={(ev) =>
                      setCtaModal({ ...ctaModal, form: { ...ctaModal.form, targetExternalUrl: ev.target.value } })
                    }
                    required
                  />
                </div>
              ) : (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  Для внутренних target (PROGRAM/SERVICE/...) передайте id в API при расширении формы.
                </p>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => setCtaModal(null)}>
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
