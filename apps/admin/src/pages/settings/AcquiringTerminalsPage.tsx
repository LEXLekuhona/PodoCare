import { PaymentProvider } from '@srs/shared-types';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { ApiError, apiRequest } from '../../api/client';
import { DeleteIcon } from '../../ui/DeleteIcon';
import EditIcon from '../../ui/EditIcon';
import { useToast } from '../../ui/ToastContext';

type StudioOption = { id: string; name: string };

type TerminalRow = {
  id: string;
  provider: PaymentProvider;
  studioId: string | null;
  studioName: string | null;
  label: string;
  publicId: string;
  notificationUrl: string | null;
  deviceDataJson: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  provider: PaymentProvider.Tinkoff | PaymentProvider.Yookassa;
  label: string;
  publicId: string;
  secret: string;
  studioId: string;
  notificationUrl: string;
  deviceDataJson: string;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  provider: PaymentProvider.Tinkoff,
  label: '',
  publicId: '',
  secret: '',
  studioId: '',
  notificationUrl: '',
  deviceDataJson: '',
  isActive: true,
});

function providerLabel(p: PaymentProvider): string {
  switch (p) {
    case PaymentProvider.Tinkoff:
      return 'Т‑Банк (эквайринг)';
    case PaymentProvider.Yookassa:
      return 'ЮKassa';
    default:
      return p;
  }
}

export function AcquiringTerminalsPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<TerminalRow[]>([]);
  const [studios, setStudios] = useState<StudioOption[]>([]);
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
      const [list, studioList] = await Promise.all([
        apiRequest<TerminalRow[]>('/admin/acquiring-terminals'),
        apiRequest<StudioOption[]>('/admin/catalog/studios'),
      ]);
      setRows(list);
      setStudios(studioList);
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
      const studioIdRaw = modal.form.studioId.trim();
      if (modal.mode === 'create') {
        await apiRequest('/admin/acquiring-terminals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: modal.form.provider,
            label: modal.form.label.trim(),
            publicId: modal.form.publicId.trim(),
            secret: modal.form.secret,
            studioId: studioIdRaw ? studioIdRaw : undefined,
            notificationUrl: modal.form.notificationUrl.trim() || undefined,
            deviceDataJson: modal.form.deviceDataJson.trim() || undefined,
            isActive: modal.form.isActive,
          }),
        });
      } else if (modal.id) {
        const body: Record<string, unknown> = {
          provider: modal.form.provider,
          label: modal.form.label.trim(),
          publicId: modal.form.publicId.trim(),
          notificationUrl: modal.form.notificationUrl.trim() || null,
          deviceDataJson: modal.form.deviceDataJson.trim() || null,
          isActive: modal.form.isActive,
          studioId: studioIdRaw ? studioIdRaw : null,
        };
        if (modal.form.secret.trim().length > 0) {
          body['secret'] = modal.form.secret;
        }
        await apiRequest(`/admin/acquiring-terminals/${modal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      setModal(null);
      await reload();
      showToast(modal.mode === 'create' ? 'Терминал добавлен' : 'Сохранено', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка сохранения');
      showToast('Не удалось сохранить', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, label: string) {
    if (!globalThis.confirm(`Удалить терминал «${label}»?`)) return;
    setError(null);
    try {
      await apiRequest(`/admin/acquiring-terminals/${id}`, { method: 'DELETE' });
      await reload();
      showToast('Удалено', 'success');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка удаления');
      showToast('Не удалось удалить', 'error');
    }
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <h1 className="page-title" style={{ flex: 1 }}>
            Эквайринг
          </h1>
          <button
            type="button"
            className="primary"
            onClick={() => setModal({ mode: 'create', form: emptyForm() })}
          >
            Добавить терминал
          </button>
        </div>
        <p className="page-subtitle">
          Терминалы Т‑Банк и магазины ЮKassa. Секрет хранится на сервере в зашифрованном виде (
          <code>DATA_ENCRYPTION_KEY</code>). Для оплаты после приёма (Т‑Банк): терминал студии → платформенный →{' '}
          <code>TINKOFF_*</code> в окружении. Онлайн-оплата заказов из приложения по ЮKassa в коде API пока берётся из{' '}
          <code>YOOKASSA_*</code> в env — записи ЮKassa здесь можно вести про запас.
        </p>
      </div>

      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Загрузка…</p>
      ) : (
        <div className="table-wrap sticky-head">
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Провайдер</th>
                <th>Студия</th>
                <th>Публичный ID</th>
                <th>Активен</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--muted)' }}>
                    Нет терминалов. Добавьте запись или задайте TINKOFF_* в окружении API.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.label}</td>
                    <td>{providerLabel(r.provider)}</td>
                    <td>{r.studioName ?? '— платформа —'}</td>
                    <td className="mono" style={{ fontSize: '0.85rem' }}>
                      {r.publicId}
                    </td>
                    <td>{r.isActive ? 'да' : 'нет'}</td>
                    <td>
                      <span className="inline-actions">
                        <button
                          type="button"
                          className="action-icon-btn"
                          aria-label="Изменить терминал"
                          title="Изменить"
                          onClick={() =>
                            setModal({
                              mode: 'edit',
                              id: r.id,
                              form: {
                                provider:
                                  r.provider === PaymentProvider.Yookassa
                                    ? PaymentProvider.Yookassa
                                    : PaymentProvider.Tinkoff,
                                label: r.label,
                                publicId: r.publicId,
                                secret: '',
                                studioId: r.studioId ?? '',
                                notificationUrl: r.notificationUrl ?? '',
                                deviceDataJson: r.deviceDataJson ?? '',
                                isActive: r.isActive,
                              },
                            })
                          }
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="danger action-icon-btn"
                          aria-label="Удалить терминал"
                          title="Удалить"
                          onClick={() => void remove(r.id, r.label)}
                        >
                          <DeleteIcon />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => !saving && setModal(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{modal.mode === 'create' ? 'Новый терминал' : 'Редактирование'}</h2>
            <form onSubmit={(e) => void submitModal(e)}>
              <div className="field">
                <label htmlFor="acq-provider">Провайдер</label>
                <select
                  id="acq-provider"
                  value={modal.form.provider}
                  onChange={(e) =>
                    setModal({
                      ...modal,
                      form: {
                        ...modal.form,
                        provider: e.target.value as PaymentProvider.Tinkoff | PaymentProvider.Yookassa,
                      },
                    })
                  }
                >
                  <option value={PaymentProvider.Tinkoff}>Т‑Банк (эквайринг)</option>
                  <option value={PaymentProvider.Yookassa}>ЮKassa</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="acq-label">Название в админке</label>
                <input
                  id="acq-label"
                  value={modal.form.label}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, label: e.target.value } })}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="acq-public">
                  {modal.form.provider === PaymentProvider.Tinkoff ? 'TerminalKey' : 'Shop ID'}
                </label>
                <input
                  id="acq-public"
                  className="mono"
                  value={modal.form.publicId}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, publicId: e.target.value } })}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="acq-secret">
                  {modal.form.provider === PaymentProvider.Tinkoff ? 'Пароль терминала' : 'Секретный ключ'}
                </label>
                <input
                  id="acq-secret"
                  type="password"
                  value={modal.form.secret}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, secret: e.target.value } })}
                  required={modal.mode === 'create'}
                  autoComplete="new-password"
                  placeholder={modal.mode === 'edit' ? 'Оставьте пустым, чтобы не менять' : ''}
                />
              </div>
              <div className="field">
                <label htmlFor="acq-studio">Студия (не выбрано — для всей платформы)</label>
                <select
                  id="acq-studio"
                  value={modal.form.studioId}
                  onChange={(e) => setModal({ ...modal, form: { ...modal.form, studioId: e.target.value } })}
                >
                  <option value="">Платформа (все студии без своего терминала)</option>
                  {studios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="acq-notify">URL уведомлений (Т‑Банк, опционально)</label>
                <input
                  id="acq-notify"
                  type="url"
                  value={modal.form.notificationUrl}
                  onChange={(e) =>
                    setModal({ ...modal, form: { ...modal.form, notificationUrl: e.target.value } })
                  }
                  placeholder="https://api.example.com/api/v1/webhooks/tinkoff"
                />
              </div>
              <div className="field">
                <label htmlFor="acq-data">DATA JSON (Т‑Банк, опционально)</label>
                <textarea
                  id="acq-data"
                  value={modal.form.deviceDataJson}
                  onChange={(e) =>
                    setModal({ ...modal, form: { ...modal.form, deviceDataJson: e.target.value } })
                  }
                  rows={3}
                />
              </div>
              <div className="field" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  id="acq-active"
                  type="checkbox"
                  checked={modal.form.isActive}
                  onChange={(e) =>
                    setModal({ ...modal, form: { ...modal.form, isActive: e.target.checked } })
                  }
                />
                <label htmlFor="acq-active" style={{ margin: 0 }}>
                  Активен
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setModal(null)} disabled={saving}>
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
