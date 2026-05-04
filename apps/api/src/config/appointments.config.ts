import { registerAs } from '@nestjs/config';

export interface AppointmentsConfig {
  minLeadMinutes: number;
}

export default registerAs<AppointmentsConfig>('appointments', () => ({
  minLeadMinutes: Number(process.env.APPOINTMENT_MIN_LEAD_MINUTES ?? 0),
}));
