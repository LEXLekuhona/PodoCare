import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

export type MedicalCardHistoryItemDto = {
  id: string;
  startsAt: string;
  specialistName: string;
  specialistRole: string;
  serviceLabel: string;
  summary: string | null;
  diagnosis: string | null;
  actions: string[];
  recommendations: string | null;
};

export type MedicalCardDto = {
  basics: {
    birthDate: string | null;
    allergies: string | null;
    chronicConditions: string | null;
    contraindications: string | null;
  };
  specialist: {
    contraindications: string | null;
    plan: string[];
    recommendations: string | null;
    filledAt: string | null;
    specialistName: string | null;
    specialistRole: string | null;
  };
  history: MedicalCardHistoryItemDto[];
};

export async function fetchMedicalCard(): Promise<MedicalCardDto> {
  return apiFetchJsonAuth<MedicalCardDto>('/me/medical-card');
}
