import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

import {
  getCachedNextAppointment,
  refreshNextAppointmentRemote,
  subscribeNextAppointment,
} from '@/features/appointment/next-appointment-session';
import type { NextAppointmentDto } from '@/features/appointment/next-appointment.types';
import { getMe, type MeProfile } from '@/features/user/me-api';
import { loadSelectedStudio, type SelectedStudio } from '@/features/studio/local-studio-storage';
import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';
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

export type FaqItemDto = {
  id: string;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
};

export type ContentFeedItemDto = {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  format: string;
  seriesId: string;
};

export function useHomeScreenData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<MeProfile | null>(null);
  const [faq, setFaq] = useState<FaqItemDto[]>([]);
  const [feedItems, setFeedItems] = useState<ContentFeedItemDto[]>([]);
  const [nextAppointment, setNextAppointment] = useState<NextAppointmentDto | null>(() =>
    getCachedNextAppointment(),
  );
  const [selectedStudio, setSelectedStudio] = useState<SelectedStudio | null>(null);

  useEffect(() => subscribeNextAppointment(setNextAppointment), []);

  const reload = useCallback(async () => {
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
      const [faqRes, feedRes, studioLocal] = await Promise.all([
        apiFetchJsonAuth<FaqItemDto[]>('/faq'),
        apiFetchJsonAuth<{ items: ContentFeedItemDto[] }>('/content/feed'),
        loadSelectedStudio(),
      ]);
      setFaq(faqRes);
      setFeedItems(feedRes.items ?? []);
      setSelectedStudio(studioLocal);
      setError(null);
    } catch (e: unknown) {
      setError(loadErrorMessage(e));
    } finally {
      const studioLocal = await loadSelectedStudio();
      if (studioLocal != null) setSelectedStudio(studioLocal);
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

  const appointmentForSelectedStudio =
    nextAppointment != null &&
    (selectedStudio == null || nextAppointment.studio.id === selectedStudio.id)
      ? nextAppointment
      : null;

  const appointmentPresentation =
    appointmentForSelectedStudio == null
      ? null
      : {
          appointmentId: appointmentForSelectedStudio.id,
          ...safeFormatAppointment(appointmentForSelectedStudio.startsAt),
          statusLabel:
            appointmentStatusLabel(appointmentForSelectedStudio.status).trim() || 'Запланировано',
          specialistName:
            `${appointmentForSelectedStudio.specialist.firstName} ${appointmentForSelectedStudio.specialist.lastName}`.trim() ||
            'Специалист',
          serviceName: appointmentForSelectedStudio.service.name?.trim() || 'Услуга',
          address: appointmentForSelectedStudio.studio.address?.trim() || 'Адрес уточняется',
        };

  const studioLabel =
    selectedStudio != null ? `${selectedStudio.name}, ${selectedStudio.address}` : 'Выберите студию';

  return {
    loading,
    error,
    reload,
    firstName: me?.firstName ?? '',
    faq,
    feedItems,
    nextAppointment: appointmentForSelectedStudio,
    appointmentPresentation,
    selectedStudioId: selectedStudio?.id ?? null,
    studioLabel,
  };
}
