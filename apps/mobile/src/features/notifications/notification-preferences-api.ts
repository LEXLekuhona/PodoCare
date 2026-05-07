import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

export type NotificationPreferenceDto = {
  id: string;
  userId: string;
  marketingSmsEnabled: boolean;
  marketingPushEnabled: boolean;
  marketingEmailEnabled: boolean;
  newContentPushEnabled: boolean;
  reminderSmsEnabled: boolean;
  reminderPushEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

export type NotificationPreferencePatch = Partial<
  Pick<
    NotificationPreferenceDto,
    | 'marketingSmsEnabled'
    | 'marketingPushEnabled'
    | 'marketingEmailEnabled'
    | 'newContentPushEnabled'
    | 'reminderSmsEnabled'
    | 'reminderPushEnabled'
  >
> & {
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
};

export async function fetchNotificationPreferences(userId: string): Promise<NotificationPreferenceDto | null> {
  return apiFetchJsonAuth<NotificationPreferenceDto | null>(
    `/notifications/preferences?userId=${encodeURIComponent(userId)}`,
  );
}

export async function saveNotificationPreferences(
  userId: string,
  patch: NotificationPreferencePatch,
): Promise<NotificationPreferenceDto> {
  return apiFetchJsonAuth<NotificationPreferenceDto>('/notifications/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...patch }),
  });
}
