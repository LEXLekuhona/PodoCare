import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { PushProvider } from '@srs/shared-types';

import { getMe } from '@/features/user/me-api';
import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

import { getCachedPushRegistration, setCachedPushRegistration } from './push-token-cache';

/**
 * В Expo Go на Android (SDK 53+) remote push отключён — статический импорт `expo-notifications` падает.
 * В development build / standalone импорт безопасен.
 */
export function isRemotePushSupportedInThisRuntime(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') return false;
  return true;
}

void (async () => {
  if (!isRemotePushSupportedInThisRuntime()) return;
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
})();

/**
 * Запрашивает разрешение, получает Expo push token и регистрирует его в API.
 * Безопасно вызывать повторно: лишний запрос не уходит, если тот же пользователь и тот же токен.
 */
export async function syncPushDeviceWithServer(): Promise<void> {
  try {
    if (!isRemotePushSupportedInThisRuntime()) return;
    if (!Device.isDevice) return;

    const Notifications = await import('expo-notifications');

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    if (!token?.trim()) return;

    const profile = await getMe();
    const prev = await getCachedPushRegistration();
    if (prev?.token === token && prev.userId === profile.id) return;
    await apiFetchJsonAuth('/notifications/push-devices', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: profile.id,
        provider: PushProvider.Expo,
        token,
        deviceType: Platform.OS,
        deviceName: Device.modelName ?? undefined,
        isActive: true,
      }),
    });

    await setCachedPushRegistration({ userId: profile.id, token });
  } catch {
    // push необязателен для работы приложения
  }
}
