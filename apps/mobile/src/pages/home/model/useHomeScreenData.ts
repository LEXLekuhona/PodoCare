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
  hydrateNextAppointmentFromDisk,
  refreshNextAppointmentRemote,
  subscribeNextAppointment,
} from '@/features/appointment/next-appointment-session';
import type { NextAppointmentDto } from '@/features/appointment/next-appointment.types';
import { loadHomeSnapshot, saveHomeSnapshot, type HomeScreenSnapshotV1 } from '@/features/offline/home-screen-cache';
import { loadProfileSnapshot, saveProfileSnapshot } from '@/features/offline/profile-screen-cache';
import { getMe, type MeProfile } from '@/features/user/me-api';
import { loadSelectedStudio, type SelectedStudio } from '@/features/studio/local-studio-storage';
import { fetchFaqItems, type FaqItemDto } from '@/features/faq/faq-api';
import { ApiError } from '@/shared/api/api-error';
import { USER_OFFLINE_NO_CACHED_DATA, USER_SERVER_NO_CACHED_DATA } from '@/shared/api/user-facing-errors';
import { fetchIsOffline } from '@/shared/network/connectivity';
import { appointmentStatusLabel, formatRuAppointmentDateTime } from '@/shared/lib/format-appointment';

export type { NextAppointmentDto } from '@/features/appointment/next-appointment.types';
export type { FaqItemDto } from '@/features/faq/faq-api';

export type HomeEmptyReason = 'none' | 'offline_no_cache' | 'server_no_cache';

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

function stubMeFromHome(h: HomeScreenSnapshotV1): MeProfile {
  return {
    id: '',
    role: 'CLIENT',
    phone: '',
    email: null,
    firstName: h.firstName,
    lastName: '',
    birthDate: null,
    avatarUrl: null,
  };
}

function snapshotFromLive(
  firstName: string,
  faqRes: FaqItemDto[],
  concernsRes: HealthConcernDto[],
  directionsRes: StudioDirectionDto[],
): HomeScreenSnapshotV1 {
  return {
    v: 1,
    firstName,
    faq: faqRes.map((x) => ({ id: x.id, question: x.question, answer: x.answer })),
    healthConcerns: concernsRes.map((x) => ({ id: x.id, slug: x.slug, title: x.title })),
    studioDirections: directionsRes.map((x) => ({
      id: x.id,
      slug: x.slug,
      title: x.title,
      iconKey: x.iconKey,
    })),
  };
}

export function useHomeScreenData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emptyReason, setEmptyReason] = useState<HomeEmptyReason>('none');
  const [me, setMe] = useState<MeProfile | null>(null);
  const [faq, setFaq] = useState<FaqItemDto[]>([]);
  const [healthConcerns, setHealthConcerns] = useState<HealthConcernDto[]>([]);
  const [studioDirections, setStudioDirections] = useState<StudioDirectionDto[]>([]);
  const [nextAppointment, setNextAppointment] = useState<NextAppointmentDto | null>(() =>
    getCachedNextAppointment(),
  );
  const [selectedStudio, setSelectedStudio] = useState<SelectedStudio | null>(null);

  useEffect(() => subscribeNextAppointment(setNextAppointment), []);

  const applyHomeDisk = useCallback((disk: HomeScreenSnapshotV1) => {
    setFaq(disk.faq as FaqItemDto[]);
    setHealthConcerns(disk.healthConcerns as HealthConcernDto[]);
    setStudioDirections(disk.studioDirections as StudioDirectionDto[]);
  }, []);

  const reload = useCallback(async () => {
    await hydrateNextAppointmentFromDisk();
    const offline = await fetchIsOffline();
    const homeDisk = await loadHomeSnapshot();
    const profDisk = await loadProfileSnapshot();

    if (offline) {
      setLoading(true);
      setError(null);
      setEmptyReason('none');
      const studioLocal = await loadSelectedStudio();
      setSelectedStudio(studioLocal);
      if (homeDisk) {
        applyHomeDisk(homeDisk);
        setMe(profDisk ?? stubMeFromHome(homeDisk));
        setEmptyReason('none');
      } else {
        setFaq([]);
        setHealthConcerns([]);
        setStudioDirections([]);
        setMe(null);
        setEmptyReason('offline_no_cache');
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setEmptyReason('none');
    let studioLocal: SelectedStudio | null = null;
    let meRes: MeProfile | null = null;

    try {
      meRes = await getMe();
      setMe(meRes);
      await saveProfileSnapshot(meRes);
    } catch (e: unknown) {
      if (profDisk) {
        meRes = profDisk;
        setMe(profDisk);
      } else if (homeDisk) {
        meRes = stubMeFromHome(homeDisk);
        setMe(meRes);
      } else {
        setMe(null);
        setEmptyReason('server_no_cache');
        setFaq([]);
        setHealthConcerns([]);
        setStudioDirections([]);
        setLoading(false);
        await refreshNextAppointmentRemote((await loadSelectedStudio())?.id);
        return;
      }
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
      const snap = snapshotFromLive(
        meRes?.firstName ?? homeDisk?.firstName ?? '',
        faqRes,
        concernsRes,
        directionsRes,
      );
      await saveHomeSnapshot(snap);
      setEmptyReason('none');
    } catch (e: unknown) {
      if (homeDisk) {
        applyHomeDisk(homeDisk);
        setError(null);
        setEmptyReason('none');
        studioLocal = await loadSelectedStudio();
        setSelectedStudio(studioLocal);
        if (meRes == null && profDisk) setMe(profDisk);
      } else {
        setEmptyReason('server_no_cache');
        setFaq([]);
        setHealthConcerns([]);
        setStudioDirections([]);
        setMe(null);
      }
      if (!homeDisk) {
        setError(loadErrorMessage(e));
      }
    } finally {
      await refreshNextAppointmentRemote(studioLocal?.id ?? (await loadSelectedStudio())?.id);
      setLoading(false);
    }
  }, [applyHomeDisk]);

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
        if (await fetchIsOffline()) {
          const studioLocal = await loadSelectedStudio();
          if (!cancelled) setSelectedStudio(studioLocal);
          return;
        }
        const studioLocal = await loadSelectedStudio();
        if (!cancelled) setSelectedStudio(studioLocal);
        try {
          const meRes = await getMe();
          if (!cancelled) setMe(meRes);
          if (meRes) await saveProfileSnapshot(meRes);
        } catch {
          /* имя могло обновиться на другом экране */
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

  const emptyMessage =
    emptyReason === 'offline_no_cache'
      ? USER_OFFLINE_NO_CACHED_DATA
      : emptyReason === 'server_no_cache'
        ? USER_SERVER_NO_CACHED_DATA
        : null;

  return {
    loading,
    error,
    emptyReason,
    emptyMessage,
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
