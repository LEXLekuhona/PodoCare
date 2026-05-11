import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NextAppointmentDto } from '@/features/appointment/next-appointment.types';

const KEY = 'srs.snapshot.nextAppointment.v1';

export async function loadNextAppointmentFromDisk(): Promise<NextAppointmentDto | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NextAppointmentDto | null;
    if (!parsed || typeof parsed !== 'object' || typeof (parsed as NextAppointmentDto).id !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveNextAppointmentToDisk(next: NextAppointmentDto | null): Promise<void> {
  if (next == null) {
    await AsyncStorage.removeItem(KEY);
    return;
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function clearNextAppointmentDisk(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
