export const APPOINTMENTS_QUEUE = 'appointments';
export const APPOINTMENT_AUTO_START_JOB = 'appointment.auto-start';
export const APPOINTMENT_AUTO_NO_SHOW_JOB = 'appointment.auto-no-show';
export const APPOINTMENT_LIFECYCLE_JOB_PREFIX = 'appointment-lifecycle';

export interface AppointmentLifecycleJobData {
  appointmentId: string;
}
