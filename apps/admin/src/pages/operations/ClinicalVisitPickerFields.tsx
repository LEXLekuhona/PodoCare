import { appointmentStatusLabelForPicker } from './clinical-shared';

import type { AppointmentRow, StudioRow } from './clinical-shared';

export function ClinicalVisitPickerFields(props: {
  studios: StudioRow[];
  studioId: string;
  onStudioIdChange: (id: string) => void;
  appointments: AppointmentRow[];
  selectedAppointmentId: string;
  onAppointmentIdChange: (id: string) => void;
  loading: boolean;
  ids: { studio: string; appointment: string };
}) {
  return (
    <div className="surface-card">
      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor={props.ids.studio}>Студия (опционально)</label>
        <select id={props.ids.studio} value={props.studioId} onChange={(ev) => props.onStudioIdChange(ev.target.value)}>
          <option value="">Все доступные</option>
          {props.studios.map((studio) => (
            <option key={studio.id} value={studio.id}>
              {studio.name} ({studio.city})
            </option>
          ))}
        </select>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor={props.ids.appointment}>Визит клиента</label>
        <select
          id={props.ids.appointment}
          value={props.selectedAppointmentId}
          onChange={(ev) => props.onAppointmentIdChange(ev.target.value)}
          disabled={props.loading || props.appointments.length === 0}
        >
          {props.appointments.map((item) => (
            <option key={item.id} value={item.id}>
              {new Date(item.startsAt).toLocaleString('ru-RU')} •{' '}
              {(item.client?.firstName || item.client?.lastName)
                ? `${item.client?.lastName ?? ''} ${item.client?.firstName ?? ''}`.trim()
                : item.walkIn
                  ? `${item.walkIn.lastName} ${item.walkIn.firstName} · ${item.walkIn.phone} (без приложения)`
                  : item.clientUserId
                    ? `client ${item.clientUserId}`
                    : 'клиент не указан'}{' '}
              • {appointmentStatusLabelForPicker(item.status, item.endsAt)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
