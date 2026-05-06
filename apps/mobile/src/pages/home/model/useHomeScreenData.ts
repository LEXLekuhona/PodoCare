import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

import {
  fetchHealthConcerns,
  fetchStudioDirections,
  type HealthConcernDto,
  type StudioDirectionDto,
} from '@/features/booking/booking-api';
import {
  getCachedNextAppointment,
  refreshNextAppointmentRemote,
  subscribeNextAppointment,
} from '@/features/appointment/next-appointment-session';
import type { NextAppointmentDto } from '@/features/appointment/next-appointment.types';
import { getMe, type MeProfile } from '@/features/user/me-api';
import { loadSelectedStudio, type SelectedStudio } from '@/features/studio/local-studio-storage';
import { fetchFaqItems, type FaqItemDto } from '@/features/faq/faq-api';
import { ApiError } from '@/shared/api/api-error';
import { appointmentStatusLabel, formatRuAppointmentDateTime } from '@/shared/lib/format-appointment';

export type { NextAppointmentDto } from '@/features/appointment/next-appointment.types';

function loadErrorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Не удалось загрузить данные';
}

function safeFormatAppointment(iso: string): { dateLine: string; timeLine: string } {
  try {
    return formatRuAppointmentDateTime(iso);
  } catch {
    return { dateLine: 'Ближайшая запись', timeLine: 'Время уточняется' };
  }
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export type { FaqItemDto } from '@/features/faq/faq-api';

export function useHomeScreenData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<MeProfile | null>(null);
  const [faq, setFaq] = useState<FaqItemDto[]>([]);
  const [healthConcerns, setHealthConcerns] = useState<HealthConcernDto[]>([]);
  const [studioDirections, setStudioDirections] = useState<StudioDirectionDto[]>([]);
  const [nextAppointment, setNextAppointment] = useState<NextAppointmentDto | null>(() =>
    getCachedNextAppointment(),
  );
  const [selectedStudio, setSelectedStudio] = useState<SelectedStudio | null>(null);
  
  useEffect(() => subscribeNextAppointment(setNextAppointment), []);
  
  const reload = useCallback(async () => {
    let studioLocal: SelectedStudio | null = null;
    setLoading(true);
    setError(null);
    try {
      const meRes = await getMe();
      setMe(meRes);
    } catch (e: unknown) {
      setMe(null);
      setError(loadErrorMessage(e));
      setLoading(false);
      return;
    }
    try {
      const [faqRes, concernsRes, directionsRes, studioRes] = await Promise.all([
        fetchFaqItems(),
        fetchHealthConcerns(),
        fetchStudioDirections(),
        loadSelectedStudio(),
      ]);
      studioLocal = studioRes;
      setFaq(faqRes);
      setHealthConcerns(concernsRes);
      setStudioDirections(directionsRes);
      setSelectedStudio(studioLocal);
      setError(null);
    } catch (e: unknown) {
      setError(loadErrorMessage(e));
      studioLocal = await loadSelectedStudio();
      if (studioLocal != null) setSelectedStudio(studioLocal);
      setHealthConcerns([]);
      setStudioDirections([]);
    } finally {
      await refreshNextAppointmentRemote(studioLocal?.id);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void refreshNextAppointmentRemote(selectedStudio?.id);
  }, [selectedStudio?.id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const studioLocal = await loadSelectedStudio();
        if (!cancelled) setSelectedStudio(studioLocal);
        try {
          const meRes = await getMe();
          if (!cancelled) setMe(meRes);
        } catch {
          /* имя могло обновиться на другом экране — без повторного сброса всего домашнего состояния */
        }
        await refreshNextAppointmentRemote(studioLocal?.id);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const nextStudioId = toTrimmedString(nextAppointment?.studio?.id);

  const appointmentForSelectedStudio =
    nextAppointment != null &&
    nextStudioId !== '' &&
    (selectedStudio == null || nextStudioId === selectedStudio.id)
      ? nextAppointment
      : null;

  const appointmentPresentation =
    appointmentForSelectedStudio == null
      ? null
      : {
          appointmentId: appointmentForSelectedStudio.id,
          ...safeFormatAppointment(appointmentForSelectedStudio.startsAt),
          statusLabel:
            toTrimmedString(
              appointmentStatusLabel(toTrimmedString(appointmentForSelectedStudio.status)),
            ) || 'Запланировано',
          specialistName: [
            toTrimmedString(appointmentForSelectedStudio.specialist?.firstName),
            toTrimmedString(appointmentForSelectedStudio.specialist?.lastName),
          ]
            .filter(Boolean)
            .join(' ') || 'Специалист',
          serviceName: toTrimmedString(appointmentForSelectedStudio.service?.name) || 'Услуга',
          address: toTrimmedString(appointmentForSelectedStudio.studio?.address) || 'Адрес уточняется',
        };

  const studioLabel =
    selectedStudio != null ? `${selectedStudio.name}, ${selectedStudio.address}` : 'Выберите студию';

  return {
    loading,
    error,
    reload,
    firstName: me?.firstName ?? '',
    faq,
    healthConcerns,
    studioDirections,
    nextAppointment: appointmentForSelectedStudio,
    appointmentPresentation,
    selectedStudioId: selectedStudio?.id ?? null,
    studioLabel,
  };
}
