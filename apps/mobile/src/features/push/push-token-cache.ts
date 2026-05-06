import AsyncStorage from '@react-native-async-storage/async-storage';

import { SRS_REGISTERED_EXPO_PUSH_TOKEN_KEY } from './constants';

export type CachedPushRegistration = { userId: string; token: string };

export async function getCachedPushRegistration(): Promise<CachedPushRegistration | null> {
  try {
    const raw = await AsyncStorage.getItem(SRS_REGISTERED_EXPO_PUSH_TOKEN_KEY);
    if (!raw?.trim()) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('userId' in parsed) ||
      !('token' in parsed) ||
      typeof (parsed as { userId: unknown }).userId !== 'string' ||
      typeof (parsed as { token: unknown }).token !== 'string'
    ) {
      return null;
    }
    return { userId: (parsed as { userId: string }).userId, token: (parsed as { token: string }).token };
  } catch {
    return null;
  }
}

export async function setCachedPushRegistration(value: CachedPushRegistration): Promise<void> {
  try {
    await AsyncStorage.setItem(SRS_REGISTERED_EXPO_PUSH_TOKEN_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export async function clearRegisteredPushTokenCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SRS_REGISTERED_EXPO_PUSH_TOKEN_KEY);
  } catch {
    // ignore
  }
}
