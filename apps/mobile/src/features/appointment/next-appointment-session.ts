import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

import {
  loadNextAppointmentFromDisk,
  saveNextAppointmentToDisk,
} from '@/features/appointment/next-appointment-disk-store';
import type { NextAppointmentDto } from '@/features/appointment/next-appointment.types';

export type { NextAppointmentDto } from '@/features/appointment/next-appointment.types';

export { clearNextAppointmentDisk } from '@/features/appointment/next-appointment-disk-store';

let cachedNext: NextAppointmentDto | null = null;
let fetchSeq = 0;
let diskHydrated = false;

type Listener = (next: NextAppointmentDto | null) => void;

const listeners = new Set<Listener>();

async function emit(next: NextAppointmentDto | null) {
  cachedNext = next;
  await saveNextAppointmentToDisk(next);
  for (const l of listeners) {
    try {
      l(next);
    } catch {
      /* noop */
    }
  }
}

/** Вызвать при старте приложения / перед первым использованием кэша. */
export async function hydrateNextAppointmentFromDisk(): Promise<void> {
  if (diskHydrated) return;
  diskHydrated = true;
  const fromDisk = await loadNextAppointmentFromDisk();
  if (fromDisk != null) {
    cachedNext = fromDisk;
    for (const l of listeners) {
      try {
        l(cachedNext);
      } catch {
        /* noop */
      }
    }
  }
}

/** Последнее успешно загруженное значение (в т.ч. после записи, когда главная ещё размонтирована). */
export function getCachedNextAppointment(): NextAppointmentDto | null {
  return cachedNext;
}

/** Подписка главной (и др.) на обновления; сразу вызывается с кэшем. */
export function subscribeNextAppointment(listener: Listener): () => void {
  listeners.add(listener);
  listener(cachedNext);
  return () => listeners.delete(listener);
}

/** Загрузить с сервера и разослать подписчикам. Работает без смонтированной главной — обновляет кэш. */
export async function refreshNextAppointmentRemote(studioId?: string): Promise<void> {
  if (studioId == null || studioId === '') {
    await emit(null);
    return;
  }
  const seq = ++fetchSeq;
  try {
    const path = `/appointments/next?studioId=${encodeURIComponent(studioId)}`;
    const next = await apiFetchJsonAuth<NextAppointmentDto | null>(path);
    if (seq !== fetchSeq) return;
    await emit(next);
  } catch {
    /* не затираем кэш при ошибке */
  }
}

/** После создания записи / перед возвратом на вкладки. */
export async function invalidateHomeNextAppointment(studioId?: string): Promise<void> {
  await refreshNextAppointmentRemote(studioId);
}
