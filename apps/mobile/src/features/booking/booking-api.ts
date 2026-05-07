import { AppointmentSource } from '@srs/shared-types';

import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

export type BookingSlotItemDto = {
  startsAt: string;
  label: string;
  available: boolean;
  unavailableReason?: string;
};

export type BookingSlotsDayDto = {
  date: string;
  weekdayShort: string;
  weekdayIndex: number;
  disabled: boolean;
  disabledReason?: string;
  slots: BookingSlotItemDto[];
};

export type BookingSlotsResponse = {
  timezone: string;
  slotStepMinutes: number;
  serviceDurationMinutes: number;
  days: BookingSlotsDayDto[];
};

export type StudioSpecialistDto = {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
};

export type StudioServiceDto = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
};

export type HealthConcernDto = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  iconUrl: string | null;
};

export async function fetchBookingSlots(params: {
  studioId: string;
  specialistId: string;
  serviceId: string;
  days?: number;
}): Promise<BookingSlotsResponse> {
  const q = new URLSearchParams();
  q.set('studioId', params.studioId);
  q.set('specialistId', params.specialistId);
  q.set('serviceId', params.serviceId);
  if (params.days != null) q.set('days', String(params.days));
  return apiFetchJsonAuth<BookingSlotsResponse>(`/appointments/booking-slots?${q.toString()}`);
}

export async function createAppointment(body: {
  studioId: string;
  specialistId: string;
  serviceId: string;
  clientUserId: string;
  startsAt: string;
}): Promise<{ id: string }> {
  return apiFetchJsonAuth(`/appointments`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...body,
      source: AppointmentSource.MobileApp,
    }),
  });
}

export async function cancelAppointmentByClient(
  appointmentId: string,
  opts?: { reason?: string },
): Promise<void> {
  await apiFetchJsonAuth(`/appointments/${appointmentId}/cancel-by-client`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(opts?.reason != null && opts.reason !== '' ? { reason: opts.reason } : {}),
  });
}

export async function fetchStudioSpecialists(
  studioId: string,
  opts?: { serviceId?: string },
): Promise<StudioSpecialistDto[]> {
  const q =
    opts?.serviceId != null && opts.serviceId !== ''
      ? `?serviceId=${encodeURIComponent(opts.serviceId)}`
      : '';
  return apiFetchJsonAuth<StudioSpecialistDto[]>(`/studios/${studioId}/specialists${q}`);
}

export async function fetchStudioServices(studioId: string): Promise<StudioServiceDto[]> {
  return apiFetchJsonAuth<StudioServiceDto[]>(`/studios/${studioId}/services`);
}

export async function fetchSpecialistServices(
  studioId: string,
  specialistId: string,
): Promise<StudioServiceDto[]> {
  return apiFetchJsonAuth<StudioServiceDto[]>(
    `/studios/${studioId}/specialists/${specialistId}/services`,
  );
}

export async function fetchHealthConcerns(): Promise<HealthConcernDto[]> {
  return apiFetchJsonAuth<HealthConcernDto[]>('/studios/health-concerns');
}

export async function fetchHealthConcernBySlug(slug: string): Promise<HealthConcernDto> {
  return apiFetchJsonAuth<HealthConcernDto>(`/studios/health-concerns/${encodeURIComponent(slug)}`);
}

export type StudioDirectionDto = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  iconKey: string;
};

export async function fetchStudioDirections(): Promise<StudioDirectionDto[]> {
  return apiFetchJsonAuth<StudioDirectionDto[]>('/studios/studio-directions');
}

export async function fetchStudioDirectionBySlug(slug: string): Promise<StudioDirectionDto> {
  return apiFetchJsonAuth<StudioDirectionDto>(
    `/studios/studio-directions/${encodeURIComponent(slug)}`,
  );
}
