export function formatRuAppointmentDateTime(iso: string): { dateLine: string; timeLine: string } {
  const d = new Date(iso);
  const dateLine =
    new Intl.DateTimeFormat('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(d).replace(/^./, (c) => c.toUpperCase());

  const timeLine = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);

  return { dateLine, timeLine };
}

export function appointmentStatusLabel(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'Подтверждено';
    case 'PENDING':
      return 'Ожидает подтверждения';
    case 'IN_PROGRESS':
      return 'Приём идёт';
    default:
      return status;
  }
}
