import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View as RNView,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import {
  fetchNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferenceDto,
} from '@/features/notifications/notification-preferences-api';
import { getMe } from '@/features/user/me-api';
import { ApiError } from '@/shared/api/api-error';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

const GREEN = '#2D6A4F';

const defaultPrefs: Omit<NotificationPreferenceDto, 'id' | 'userId' | 'quietHoursStart' | 'quietHoursEnd'> & {
  quietHoursStart: null;
  quietHoursEnd: null;
} = {
  marketingSmsEnabled: true,
  marketingPushEnabled: true,
  marketingEmailEnabled: true,
  newContentPushEnabled: true,
  reminderSmsEnabled: true,
  reminderPushEnabled: true,
  quietHoursStart: null,
  quietHoursEnd: null,
};

function prefsFromRow(row: NotificationPreferenceDto | null, uid: string): NotificationPreferenceDto {
  if (row != null) return row;
  return {
    id: '',
    userId: uid,
    ...defaultPrefs,
  };
}

export function NotificationSettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferenceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getMe();
      setUserId(me.id);
      const row = await fetchNotificationPreferences(me.id);
      setPrefs(prefsFromRow(row, me.id));
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Не удалось загрузить настройки';
      Alert.alert('Ошибка', msg);
      setPrefs(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggle = async (
    key: keyof Pick<
      NotificationPreferenceDto,
      | 'reminderPushEnabled'
      | 'reminderSmsEnabled'
      | 'newContentPushEnabled'
      | 'marketingPushEnabled'
      | 'marketingSmsEnabled'
      | 'marketingEmailEnabled'
    >,
    value: boolean,
  ) => {
    if (!userId || !prefs) return;
    const prev = prefs[key];
    setPrefs({ ...prefs, [key]: value });
    setSavingKey(key);
    try {
      const updated = await saveNotificationPreferences(userId, { [key]: value });
      setPrefs(prefsFromRow(updated, userId));
    } catch (e) {
      setPrefs({ ...prefs, [key]: prev });
      const msg = e instanceof ApiError ? e.message : 'Не удалось сохранить';
      Alert.alert('Ошибка', msg);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <View style={styles.root} lightColor="#F8F9FA" darkColor="#06130E">
      <SafeAreaPadding minTop={10} minBottom={0} style={styles.topNav} lightColor="transparent" darkColor="transparent">
        <RNView style={styles.headerRow}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(app)/(tabs)/profile');
            }}
            accessibilityLabel="Назад"
            style={({ pressed }) => [styles.headerSideBtn, pressed && styles.pressed]}
          >
            <Text style={styles.backGlyph} lightColor="#2D6A4F" darkColor="#95D4B3">
              ‹
            </Text>
          </Pressable>
          <Text style={styles.headerTitle} lightColor={GREEN} darkColor="#95D4B3">
            Уведомления
          </Text>
          <RNView style={styles.headerSideBtn} />
        </RNView>
      </SafeAreaPadding>

      {loading ? (
        <RNView style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.hint} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
            Загрузка…
          </Text>
        </RNView>
      ) : prefs && userId ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
            Выберите, какие сообщения можно присылать. Сервисные уведомления о записи и статусах заказов не отключаются.
          </Text>

          <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
            <Text style={styles.cardCaption} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
              Записи
            </Text>
            <ToggleRow
              icon="calendar-check-o"
              label="Напоминания о визите (push)"
              value={prefs.reminderPushEnabled}
              disabled={savingKey === 'reminderPushEnabled'}
              onValueChange={(v) => void onToggle('reminderPushEnabled', v)}
            />
            <RowDivider />
            <ToggleRow
              icon="mobile"
              label="Напоминания о визите (SMS)"
              value={prefs.reminderSmsEnabled}
              disabled={savingKey === 'reminderSmsEnabled'}
              onValueChange={(v) => void onToggle('reminderSmsEnabled', v)}
            />
          </View>

          <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
            <Text style={styles.cardCaption} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
              Обучение и контент
            </Text>
            <ToggleRow
              icon="graduation-cap"
              label="Новые материалы и уроки (push)"
              value={prefs.newContentPushEnabled}
              disabled={savingKey === 'newContentPushEnabled'}
              onValueChange={(v) => void onToggle('newContentPushEnabled', v)}
            />
          </View>

          <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
            <Text style={styles.cardCaption} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
              Маркетинг и акции
            </Text>
            <ToggleRow
              icon="bullhorn"
              label="Акции и новости (push)"
              value={prefs.marketingPushEnabled}
              disabled={savingKey === 'marketingPushEnabled'}
              onValueChange={(v) => void onToggle('marketingPushEnabled', v)}
            />
            <RowDivider />
            <ToggleRow
              icon="commenting-o"
              label="Акции и новости (SMS)"
              value={prefs.marketingSmsEnabled}
              disabled={savingKey === 'marketingSmsEnabled'}
              onValueChange={(v) => void onToggle('marketingSmsEnabled', v)}
            />
            <RowDivider />
            <ToggleRow
              icon="envelope-o"
              label="Акции и новости (email)"
              value={prefs.marketingEmailEnabled}
              disabled={savingKey === 'marketingEmailEnabled'}
              onValueChange={(v) => void onToggle('marketingEmailEnabled', v)}
            />
          </View>
        </ScrollView>
      ) : (
        <RNView style={styles.centered}>
          <Text style={styles.hint} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
            Не удалось загрузить настройки.
          </Text>
          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
            <Text style={styles.retryText} lightColor={GREEN} darkColor="#95D4B3">
              Повторить
            </Text>
          </Pressable>
        </RNView>
      )}
    </View>
  );
}

function RowDivider() {
  return <View style={styles.divider} lightColor="rgba(149,163,160,0.25)" darkColor="rgba(255,255,255,0.08)" />;
}

function ToggleRow(props: {
  icon: ComponentProps<typeof FontAwesome>['name'];
  label: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <RNView style={styles.toggleRow}>
      <RNView style={styles.toggleIcon}>
        <FontAwesome name={props.icon} size={18} color={GREEN} />
      </RNView>
      <Text style={styles.toggleLabel} lightColor="#1A1A2E" darkColor="#FFFFFF">
        {props.label}
      </Text>
      <Switch
        value={props.value}
        onValueChange={props.onValueChange}
        disabled={props.disabled}
        trackColor={{ false: 'rgba(149,163,160,0.35)', true: 'rgba(45,106,79,0.45)' }}
        thumbColor={Platform.OS === 'android' ? (props.value ? GREEN : '#f4f3f4') : undefined}
      />
    </RNView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topNav: { paddingHorizontal: 8, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSideBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { fontSize: 28, fontWeight: '300' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  scroll: { padding: 20, paddingBottom: 40, gap: 16 },
  lead: { fontSize: 14, lineHeight: 20, fontWeight: '500', fontFamily: 'Inter_500Medium', marginBottom: 4 },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    overflow: 'hidden',
    paddingBottom: 4,
  },
  cardCaption: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  toggleIcon: { width: 28, alignItems: 'center' },
  toggleLabel: { flex: 1, fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  hint: { fontSize: 15, textAlign: 'center' },
  retry: { paddingVertical: 12, paddingHorizontal: 20 },
  retryText: { fontSize: 16, fontWeight: '800', fontFamily: 'PlusJakartaSans_800ExtraBold' },
  pressed: { opacity: 0.85 },
});
