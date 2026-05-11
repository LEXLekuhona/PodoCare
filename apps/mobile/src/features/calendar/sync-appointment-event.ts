import * as Calendar from 'expo-calendar';
import type { Source } from 'expo-calendar';
import { Platform } from 'react-native';

const APP_CALENDAR_TITLE = 'Solodova';
const APP_CALENDAR_INTERNAL = 'solodova_appointments';

export type SyncAppointmentCalendarInput = {
  startsAt: Date;
  endDate: Date;
  title: string;
  location: string;
  notes: string;
};

async function pickWritableCalendarId(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    try {
      const def = await Calendar.getDefaultCalendarAsync();
      if (def?.id && def.allowsModifications) {
        return def.id;
      }
    } catch {
      /* getDefaultCalendarAsync — iOS; на других платформах не вызываем */
    }
  }

  // На Android `entityType` в getCalendarsAsync задокументирован как iOS-only; без фильтра список полный.
  const calendars =
    Platform.OS === 'ios'
      ? await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
      : await Calendar.getCalendarsAsync();
  const writable = calendars.filter((c) => c.allowsModifications);
  return writable[0]?.id ?? null;
}

async function createAppCalendarId(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') {
      const def = await Calendar.getDefaultCalendarAsync();
      const source = def.source;
      if (!source?.name) return null;
      return await Calendar.createCalendarAsync({
        title: APP_CALENDAR_TITLE,
        color: '#2D6A4F',
        entityType: Calendar.EntityTypes.EVENT,
        name: APP_CALENDAR_INTERNAL,
        ownerAccount: def.ownerAccount ?? 'personal',
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
        source,
        sourceId: source.id,
      });
    }

    return await Calendar.createCalendarAsync({
      title: APP_CALENDAR_TITLE,
      color: '#2D6A4F',
      entityType: Calendar.EntityTypes.EVENT,
      name: APP_CALENDAR_INTERNAL,
      ownerAccount: 'personal',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
      // Локальный аккаунт Android: поле type в рантайме не требуется (см. документацию Expo).
      source: {
        isLocalAccount: true,
        name: APP_CALENDAR_TITLE,
      } as Source,
    });
  } catch {
    return null;
  }
}

async function ensureWritableCalendarId(): Promise<string | null> {
  const existing = await pickWritableCalendarId();
  if (existing) return existing;
  return createAppCalendarId();
}

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
  } catch {
    return 'Europe/Moscow';
  }
}

/**
 * Добавляет событие приёма в календарь устройства. Запрашивает разрешение при необходимости.
 * @returns true, если событие создано
 */
export async function syncAppointmentToDeviceCalendar(
  input: SyncAppointmentCalendarInput,
): Promise<boolean> {
  const perm = await Calendar.requestCalendarPermissionsAsync();
  if (perm.status !== 'granted') {
    return false;
  }

  const calendarId = await ensureWritableCalendarId();
  if (!calendarId) {
    return false;
  }

  const tz = deviceTimeZone();

  try {
    await Calendar.createEventAsync(calendarId, {
      title: input.title,
      startDate: input.startsAt,
      endDate: input.endDate,
      timeZone: tz,
      location: input.location,
      notes: input.notes,
      alarms: [{ relativeOffset: -10 * 60 }],
    });
    return true;
  } catch {
    return false;
  }
}
