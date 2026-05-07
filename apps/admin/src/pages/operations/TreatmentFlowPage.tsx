import { UserRole } from '@srs/shared-types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

type StudioRow = {
  id: string;
  name: string;
  city: string;
};

type ServiceRow = {
  id: string;
  name: string;
  isActive: boolean;
};

type AppointmentRow = {
  id: string;
  studioId: string;
  clientUserId: string | null;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  specialistId: string;
  startsAt: string;
  status: string;
};

type PlanStepRow = {
  id: string;
  sortOrder: number;
  title: string;
  recommendation: string | null;
  dueDate: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';
};

type TreatmentPlanRow = {
  id: string;
  title: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  validFrom: string;
  validUntil: string | null;
  updateComment: string | null;
  steps: PlanStepRow[];
  revisions?: Array<{
    id: string;
    updatedAt: string;
    reason: string | null;
    comment: string | null;
    updatedBy: string | null;
  }>;
};

type ProtocolForm = {
  procedureServiceIds: string[];
  diagnosis: string;
  materialsUsed: string;
  internalNote: string;
  clientVisible: boolean;
  reason: string;
  comment: string;
};

type PlanForm = {
  title: string;
  validFrom: string;
  validUntil: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  stepsText: string;
  reason: string;
  comment: string;
};

function appointmentStatusRu(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'Ожидает подтверждения',
    CONFIRMED: 'Подтверждён',
    IN_PROGRESS: 'Идёт приём',
    COMPLETED: 'Завершён',
    NO_SHOW: 'Не явился',
    CANCELLED_BY_CLIENT: 'Отменён клиентом',
    CANCELLED_BY_STUDIO: 'Отменён студией',
    CANCELLED: 'Отменён',
  };
  return map[status] ?? status;
}

function planStatusRu(status: PlanForm['status']): string {
  const map: Record<PlanForm['status'], string> = {
    DRAFT: 'Черновик',
    ACTIVE: 'Активный',
    COMPLETED: 'Завершён',
    CANCELLED: 'Отменён',
  };
  return map[status];
}

function emptyProtocolForm(): ProtocolForm {
  return {
    procedureServiceIds: [],
    diagnosis: '',
    materialsUsed: '',
    internalNote: '',
    clientVisible: true,
    reason: '',
    comment: '',
  };
}

function emptyPlanForm(): PlanForm {
  return {
    title: '',
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: '',
    status: 'ACTIVE',
    stepsText: '',
    reason: '',
    comment: '',
  };
}

function parseSteps(text: string): Array<{
  title: string;
  recommendation?: string;
  dueDate?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';
}> {
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return rows.map((line) => {
    const parts = line.split('|').map((x) => x.trim());
    const title = parts[0] ?? '';
    const recommendation = parts[1] || undefined;
    const dueDate = parts[2] || undefined;
    const statusRaw = parts[3] as 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED' | undefined;
    const status = statusRaw && ['PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED'].includes(statusRaw) ? statusRaw : undefined;
    return { title, recommendation, dueDate, status };
  });
}

function planToForm(plan: TreatmentPlanRow): PlanForm {
  return {
    title: plan.title,
    validFrom: plan.validFrom.slice(0, 10),
    validUntil: plan.validUntil ? plan.validUntil.slice(0, 10) : '',
    status: plan.status,
    stepsText: plan.steps
      .map((step) => [step.title, step.recommendation ?? '', step.dueDate ? step.dueDate.slice(0, 10) : '', step.status].join(' | '))
      .join('\n'),
    reason: '',
    comment: plan.updateComment ?? '',
  };
}

function canUseClinicalFlow(role: UserRole | undefined): boolean {
  return (
    role === UserRole.Specialist ||
    role === UserRole.StudioAdmin ||
    role === UserRole.NetworkOwner ||
    role === UserRole.SuperAdmin
  );
}

export function TreatmentFlowPage() {
  const { user } = useAuth();
  const allowed = canUseClinicalFlow(user?.role);
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [studioId, setStudioId] = useState('');
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [serviceFilter, setServiceFilter] = useState('');
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [plans, setPlans] = useState<TreatmentPlanRow[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [protocolForm, setProtocolForm] = useState<ProtocolForm>(emptyProtocolForm);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [loading, setLoading] = useState(true);
  const [savingProtocol, setSavingProtocol] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedAppointment = useMemo(
    () => appointments.find((item) => item.id === selectedAppointmentId) ?? null,
    [appointments, selectedAppointmentId],
  );
  const selectedPlan = useMemo(() => plans.find((item) => item.id === selectedPlanId) ?? null, [plans, selectedPlanId]);

  const relevantStudioId = selectedAppointment?.studioId ?? (studioId.trim() ? studioId.trim() : null);

  const loadStudios = useCallback(async () => {
    try {
      const data = await apiRequest<StudioRow[]>('/admin/catalog/studios');
      setStudios(data);
      if (!studioId && data[0]) setStudioId(data[0].id);
    } catch {
      setStudios([]);
    }
  }, [studioId]);

  const loadAppointments = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString();
      const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
      const q = new URLSearchParams();
      if (studioId.trim()) q.set('studioId', studioId.trim());
      q.set('from', from);
      q.set('to', to);
      const rows = await apiRequest<AppointmentRow[]>(`/appointments?${q.toString()}`);
      const withClients = rows.filter((item) => item.clientUserId);
      setAppointments(withClients);
      if (!withClients.some((item) => item.id === selectedAppointmentId)) {
        setSelectedAppointmentId(withClients[0]?.id ?? '');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить визиты');
      setAppointments([]);
      setSelectedAppointmentId('');
    } finally {
      setLoading(false);
    }
  }, [allowed, studioId, selectedAppointmentId]);

  const loadServices = useCallback(async () => {
    if (!allowed) return;
    if (!relevantStudioId) {
      setServices([]);
      setProtocolForm((prev) => ({ ...prev, procedureServiceIds: [] }));
      return;
    }
    try {
      const rows = await apiRequest<ServiceRow[]>(`/admin/catalog/studios/${relevantStudioId}/services`);
      setServices(rows);
    } catch (e) {
      setServices([]);
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить список услуг');
    }
  }, [allowed, relevantStudioId]);

  const loadPlans = useCallback(async (clientUserId: string) => {
    try {
      const data = await apiRequest<TreatmentPlanRow[]>(`/clients/${clientUserId}/treatment-plans`);
      setPlans(data);
      const first = data[0];
      setSelectedPlanId(first?.id ?? '');
      if (first) setPlanForm(planToForm(first));
      else setPlanForm(emptyPlanForm());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить планы клиента');
      setPlans([]);
      setSelectedPlanId('');
      setPlanForm(emptyPlanForm());
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void loadStudios();
  }, [allowed, loadStudios]);

  useEffect(() => {
    if (!allowed) return;
    void loadAppointments();
  }, [allowed, loadAppointments]);

  useEffect(() => {
    if (!allowed) return;
    void loadServices();
    // When switching studio/appointment, clear selection to avoid carrying procedures across studios.
    setProtocolForm((prev) => ({ ...prev, procedureServiceIds: [] }));
    setServiceFilter('');
  }, [allowed, loadServices, relevantStudioId]);

  useEffect(() => {
    if (!selectedAppointment?.clientUserId) {
      setPlans([]);
      setSelectedPlanId('');
      setPlanForm(emptyPlanForm());
      return;
    }
    void loadPlans(selectedAppointment.clientUserId);
  }, [selectedAppointment?.clientUserId, loadPlans]);

  async function saveProtocol() {
    if (!selectedAppointment) return;
    setSavingProtocol(true);
    setError(null);
    setNotice(null);
    try {
      const selectedNames = new Set(protocolForm.procedureServiceIds);
      const proceduresDone = services
        .filter((s) => selectedNames.has(s.id))
        .map((s) => s.name.trim())
        .filter((s) => s.length > 0);
      const payload = {
        proceduresDone: proceduresDone.length > 0 ? proceduresDone : undefined,
        diagnosis: protocolForm.diagnosis.trim() || undefined,
        materialsUsed: protocolForm.materialsUsed.trim() || undefined,
        internalNote: protocolForm.internalNote.trim() || undefined,
        clientVisible: protocolForm.clientVisible,
        reason: protocolForm.reason.trim() || undefined,
        comment: protocolForm.comment.trim() || undefined,
      };
      try {
        await apiRequest(`/appointments/${selectedAppointment.id}/protocol`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setNotice('Протокол создан');
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          await apiRequest(`/appointments/${selectedAppointment.id}/protocol`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          setNotice('Протокол обновлен');
        } else {
          throw e;
        }
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить протокол');
    } finally {
      setSavingProtocol(false);
    }
  }

  async function createPlan() {
    if (!selectedAppointment?.clientUserId) return;
    setSavingPlan(true);
    setError(null);
    setNotice(null);
    try {
      const steps = parseSteps(planForm.stepsText).filter((step) => step.title.trim().length > 0);
      const payload = {
        appointmentId: selectedAppointment.id,
        title: planForm.title.trim(),
        validFrom: new Date(`${planForm.validFrom}T00:00:00.000Z`).toISOString(),
        validUntil: planForm.validUntil ? new Date(`${planForm.validUntil}T23:59:59.000Z`).toISOString() : undefined,
        status: planForm.status,
        steps,
        reason: planForm.reason.trim() || undefined,
        comment: planForm.comment.trim() || undefined,
      };
      await apiRequest(`/clients/${selectedAppointment.clientUserId}/treatment-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setNotice('План лечения создан');
      await loadPlans(selectedAppointment.clientUserId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось создать план');
    } finally {
      setSavingPlan(false);
    }
  }

  async function updatePlan() {
    if (!selectedAppointment?.clientUserId || !selectedPlanId) return;
    setSavingPlan(true);
    setError(null);
    setNotice(null);
    try {
      const steps = parseSteps(planForm.stepsText).filter((step) => step.title.trim().length > 0);
      const payload = {
        title: planForm.title.trim(),
        validFrom: new Date(`${planForm.validFrom}T00:00:00.000Z`).toISOString(),
        validUntil: planForm.validUntil ? new Date(`${planForm.validUntil}T23:59:59.000Z`).toISOString() : null,
        status: planForm.status,
        steps,
        reason: planForm.reason.trim() || undefined,
        comment: planForm.comment.trim() || undefined,
      };
      await apiRequest(`/clients/${selectedAppointment.clientUserId}/treatment-plans/${selectedPlanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setNotice('План лечения обновлен');
      await loadPlans(selectedAppointment.clientUserId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось обновить план');
    } finally {
      setSavingPlan(false);
    }
  }

  if (!allowed) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <h1 className="page-title">Клинический контур</h1>
          <p className="page-subtitle">Недостаточно прав для работы с протоколами и планами лечения.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Клинический контур</h1>
        <p className="page-subtitle">
          После визита: заполняйте протокол приёма и формируйте план лечения клиента с последующим обновлением.
        </p>
      </div>

      <div className="surface-card">
        <div className="field" style={{ maxWidth: 420 }}>
          <label htmlFor="tf-studio">Студия (опционально)</label>
          <select id="tf-studio" value={studioId} onChange={(ev) => setStudioId(ev.target.value)}>
            <option value="">Все доступные</option>
            {studios.map((studio) => (
              <option key={studio.id} value={studio.id}>
                {studio.name} ({studio.city})
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="tf-appointment">Визит клиента</label>
          <select
            id="tf-appointment"
            value={selectedAppointmentId}
            onChange={(ev) => setSelectedAppointmentId(ev.target.value)}
            disabled={loading || appointments.length === 0}
          >
            {appointments.map((item) => (
              <option key={item.id} value={item.id}>
                {new Date(item.startsAt).toLocaleString('ru-RU')} •{' '}
                {(item.client?.firstName || item.client?.lastName)
                  ? `${item.client?.lastName ?? ''} ${item.client?.firstName ?? ''}`.trim()
                  : item.clientUserId
                    ? `client ${item.clientUserId}`
                    : 'клиент не указан'}{' '}
                • {appointmentStatusRu(item.status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? <div className="success-banner">{notice}</div> : null}

      {!selectedAppointment ? (
        <p style={{ color: 'var(--muted)' }}>{loading ? 'Загрузка визитов…' : 'Нет доступных визитов с клиентом.'}</p>
      ) : (
        <>
          <div className="surface-card">
            <h2 style={{ marginTop: 0 }}>Протокол визита</h2>
            <div className="grid two-col">
              <div className="field">
                <label htmlFor="tf-procedures">Выполненные процедуры (выбор из услуг)</label>
                <input
                  id="tf-procedures"
                  placeholder="Фильтр услуг…"
                  value={serviceFilter}
                  onChange={(ev) => setServiceFilter(ev.target.value)}
                />
                <div style={{ marginTop: '0.5rem' }}>
                  <select
                    multiple
                    size={8}
                    value={protocolForm.procedureServiceIds}
                    onChange={(ev) => {
                      const next = Array.from(ev.currentTarget.selectedOptions).map((o) => o.value);
                      setProtocolForm((prev) => ({ ...prev, procedureServiceIds: next }));
                    }}
                    disabled={services.length === 0}
                    style={{ width: '100%' }}
                  >
                    {services
                      .filter((s) => s.isActive)
                      .filter((s) => s.name.toLowerCase().includes(serviceFilter.trim().toLowerCase()))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                  <div style={{ marginTop: '0.35rem', color: 'var(--muted)', fontSize: 13 }}>
                    Выберите несколько услуг (Cmd/Ctrl + клик).
                  </div>
                </div>
              </div>
              <div className="field">
                <label htmlFor="tf-diagnosis">Диагноз</label>
                <textarea
                  id="tf-diagnosis"
                  rows={3}
                  value={protocolForm.diagnosis}
                  onChange={(ev) => setProtocolForm((prev) => ({ ...prev, diagnosis: ev.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="tf-materials">Материалы</label>
                <input
                  id="tf-materials"
                  value={protocolForm.materialsUsed}
                  onChange={(ev) => setProtocolForm((prev) => ({ ...prev, materialsUsed: ev.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="tf-internal-note">Внутренняя заметка</label>
                <input
                  id="tf-internal-note"
                  value={protocolForm.internalNote}
                  onChange={(ev) => setProtocolForm((prev) => ({ ...prev, internalNote: ev.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="tf-reason">Причина изменения (audit)</label>
                <input
                  id="tf-reason"
                  value={protocolForm.reason}
                  onChange={(ev) => setProtocolForm((prev) => ({ ...prev, reason: ev.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="tf-comment">Комментарий (audit)</label>
                <input
                  id="tf-comment"
                  value={protocolForm.comment}
                  onChange={(ev) => setProtocolForm((prev) => ({ ...prev, comment: ev.target.value }))}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="modal-toggle">
                  <input
                    type="checkbox"
                    checked={protocolForm.clientVisible}
                    onChange={(ev) => setProtocolForm((prev) => ({ ...prev, clientVisible: ev.target.checked }))}
                  />{' '}
                  Показывать протокол клиенту
                </label>
              </div>
            </div>
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <button type="button" className="primary" onClick={() => void saveProtocol()} disabled={savingProtocol}>
                {savingProtocol ? 'Сохранение…' : 'Сохранить протокол'}
              </button>
            </div>
          </div>

          <div className="surface-card">
            <div className="toolbar">
              <h2 style={{ margin: 0, flex: 1 }}>План лечения</h2>
              <div className="field" style={{ minWidth: 280, marginBottom: 0 }}>
                <label htmlFor="tf-plan-select">Существующий план</label>
                <select
                  id="tf-plan-select"
                  value={selectedPlanId}
                  onChange={(ev) => {
                    const nextId = ev.target.value;
                    setSelectedPlanId(nextId);
                    const plan = plans.find((item) => item.id === nextId);
                    if (plan) setPlanForm(planToForm(plan));
                  }}
                >
                  <option value="">Новый план</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.title} ({new Date(plan.validFrom).toLocaleDateString('ru-RU')})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid two-col">
              <div className="field">
                <label htmlFor="tf-plan-title">Название плана</label>
                <input
                  id="tf-plan-title"
                  value={planForm.title}
                  onChange={(ev) => setPlanForm((prev) => ({ ...prev, title: ev.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="tf-plan-status">Статус</label>
                <select
                  id="tf-plan-status"
                  value={planForm.status}
                  onChange={(ev) => setPlanForm((prev) => ({ ...prev, status: ev.target.value as PlanForm['status'] }))}
                >
                  <option value="DRAFT">{planStatusRu('DRAFT')}</option>
                  <option value="ACTIVE">{planStatusRu('ACTIVE')}</option>
                  <option value="COMPLETED">{planStatusRu('COMPLETED')}</option>
                  <option value="CANCELLED">{planStatusRu('CANCELLED')}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="tf-plan-from">Действует с</label>
                <input
                  id="tf-plan-from"
                  type="date"
                  value={planForm.validFrom}
                  onChange={(ev) => setPlanForm((prev) => ({ ...prev, validFrom: ev.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="tf-plan-until">Действует до</label>
                <input
                  id="tf-plan-until"
                  type="date"
                  value={planForm.validUntil}
                  onChange={(ev) => setPlanForm((prev) => ({ ...prev, validUntil: ev.target.value }))}
                />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="tf-steps">Шаги (строка: title | recommendation | YYYY-MM-DD | STATUS)</label>
                <textarea
                  id="tf-steps"
                  rows={6}
                  value={planForm.stepsText}
                  onChange={(ev) => setPlanForm((prev) => ({ ...prev, stepsText: ev.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="tf-plan-reason">Причина изменения</label>
                <input
                  id="tf-plan-reason"
                  value={planForm.reason}
                  onChange={(ev) => setPlanForm((prev) => ({ ...prev, reason: ev.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="tf-plan-comment">Комментарий</label>
                <input
                  id="tf-plan-comment"
                  value={planForm.comment}
                  onChange={(ev) => setPlanForm((prev) => ({ ...prev, comment: ev.target.value }))}
                />
              </div>
            </div>

            <div className="toolbar" style={{ marginBottom: 0 }}>
              <button type="button" onClick={() => setPlanForm(emptyPlanForm())}>
                Очистить форму
              </button>
              <button type="button" className="primary" onClick={() => void createPlan()} disabled={savingPlan}>
                {savingPlan ? 'Сохранение…' : 'Создать план'}
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => void updatePlan()}
                disabled={savingPlan || !selectedPlanId}
              >
                {savingPlan ? 'Сохранение…' : 'Обновить план'}
              </button>
            </div>

            {selectedPlan?.revisions && selectedPlan.revisions.length > 0 ? (
              <div style={{ marginTop: '1rem' }}>
                <h3 style={{ marginBottom: '0.6rem' }}>История версий</h3>
                <div className="table-wrap sticky-head">
                  <table>
                    <thead>
                      <tr>
                        <th>Когда</th>
                        <th>Кто</th>
                        <th>Причина</th>
                        <th>Комментарий</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPlan.revisions.map((rev) => (
                        <tr key={rev.id}>
                          <td>{new Date(rev.updatedAt).toLocaleString('ru-RU')}</td>
                          <td>{rev.updatedBy ?? '—'}</td>
                          <td>{rev.reason ?? '—'}</td>
                          <td>{rev.comment ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
