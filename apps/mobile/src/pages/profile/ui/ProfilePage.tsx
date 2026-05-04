import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { logoutAndClearSession } from '@/features/auth/session-store';
import { getMe, type MeProfile } from '@/features/user/me-api';
import { clearSelectedStudio } from '@/features/studio/local-studio-storage';
import { formatRuPhoneDisplay } from '@/shared/lib/phone';
import { LeafLogo } from '@/shared/ui/icons/LeafLogo';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

const ICON_MAIN = '#2D6A4F';
const ICON_MUTED = 'rgba(112,121,115,1)';
const LOGOUT_RED = '#B42318';

function shortDisplayName(firstName: string, lastName: string): string {
  const f = firstName.trim();
  const lastInitial = lastName.trim().charAt(0);
  if (!f) return lastName.trim() || 'Клиент';
  return lastInitial ? `${f} ${lastInitial.toUpperCase()}.` : f;
}

function comingSoon(title?: string) {
  Alert.alert(title ?? 'Скоро', 'Раздел в разработке.');
}

export function ProfilePage() {
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const me = await getMe();
      setProfile(me);
    } catch {
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeApplicationVersion ?? '1.0.0';

  const performLogout = () => {
    if (loggingOut) return;
    setLoggingOut(true);
    void (async () => {
      try {
        await logoutAndClearSession();
        await clearSelectedStudio();
        setLogoutModalVisible(false);
        router.replace('/(auth)/phone');
      } finally {
        setLoggingOut(false);
      }
    })();
  };

  return (
    <View style={styles.root} lightColor="#F8F9FA" darkColor="#06130E">
      <SafeAreaPadding minTop={12} minBottom={0} style={styles.safeTop} lightColor="transparent" darkColor="transparent">
        <RNView style={styles.topBar}>
          <RNView style={styles.topBarSpacer} />
          <Pressable hitSlop={14} accessibilityLabel="Уведомления" onPress={() => comingSoon('Уведомления')}>
            <FontAwesome name="bell-o" size={22} color={ICON_MAIN} />
          </Pressable>
        </RNView>

        <RNView style={styles.hero}>
          <RNView style={styles.avatarOuter}>
            <View style={styles.avatarCircle} lightColor="#EEF1EE" darkColor="rgba(255,255,255,0.08)">
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <FontAwesome name="user" size={40} color={ICON_MUTED} />
              )}
            </View>
            <View style={styles.clientBadge} lightColor="#FFFFFF" darkColor="#0C1A14">
              <Text style={styles.clientBadgeText} lightColor="#0F5238" darkColor="#95D4B3">
                Клиент
              </Text>
            </View>
          </RNView>

          {loadingProfile ? (
            <ActivityIndicator style={styles.heroLoader} />
          ) : (
            <>
              <Text style={styles.userName} lightColor="#1A1A2E" darkColor="#FFFFFF">
                {profile ? shortDisplayName(profile.firstName, profile.lastName) : 'Клиент'}
              </Text>
              <Text style={styles.userPhone} lightColor="rgba(11,27,20,0.55)" darkColor="rgba(255,255,255,0.55)">
                {profile ? formatRuPhoneDisplay(profile.phone) : '—'}
              </Text>
            </>
          )}
        </RNView>
      </SafeAreaPadding>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionHeading} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
          ОСНОВНОЕ
        </Text>
        <View style={styles.menuCard} lightColor="#FFFFFF" darkColor="#0C1A14">
          <ProfileMenuRow
            icon={<FontAwesome name="user-o" size={18} color={ICON_MAIN} />}
            label="Редактировать профиль"
            onPress={() => router.push('/profile-edit')}
            showDivider
          />
          <ProfileMenuRow
            icon={<FontAwesome name="heartbeat" size={18} color={ICON_MAIN} />}
            label="Моя медкарта"
            onPress={() => comingSoon('Моя медкарта')}
            showDivider
          />
          <ProfileMenuRow
            icon={<FontAwesome name="graduation-cap" size={17} color={ICON_MAIN} />}
            label="Мои обучения"
            onPress={() => router.push('/(app)/(tabs)/education')}
            showDivider
          />
          <ProfileMenuRow
            icon={<FontAwesome name="shield" size={18} color={ICON_MAIN} />}
            label="Мои согласия"
            onPress={() => router.push('/(app)/consents')}
            showDivider
          />
          <ProfileMenuRow
            icon={<FontAwesome name="bell-o" size={18} color={ICON_MAIN} />}
            label="Уведомления"
            onPress={() => comingSoon('Уведомления')}
          />
        </View>

        <Text style={styles.sectionHeading} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
          ПОДДЕРЖКА
        </Text>
        <View style={styles.menuCard} lightColor="#FFFFFF" darkColor="#0C1A14">
          <ProfileMenuRow
            icon={<FontAwesome name="comments-o" size={18} color={ICON_MAIN} />}
            label="Чат поддержки"
            onPress={() => comingSoon('Чат поддержки')}
            showDivider
          />
          <ProfileMenuRow
            icon={<FontAwesome name="question-circle-o" size={18} color={ICON_MAIN} />}
            label="FAQ"
            onPress={() =>
              Alert.alert(
                'FAQ',
                'Ответы на популярные вопросы — в блоке «Популярные вопросы» на главной.',
              )
            }
            showDivider
          />
          <ProfileMenuRow
            icon={<FontAwesome name="pencil" size={17} color={ICON_MAIN} />}
            label="Оставить отзыв"
            onPress={() => comingSoon('Оставить отзыв')}
            showDivider
          />
          <ProfileMenuRow
            icon={<FontAwesome name="star-o" size={18} color={ICON_MAIN} />}
            label="Оценить приложение"
            onPress={() => router.push('/(app)/feedback')}
          />
        </View>

        <Text style={styles.sectionHeading} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
          ПРОЧЕЕ
        </Text>
        <View style={styles.menuCard} lightColor="#FFFFFF" darkColor="#0C1A14">
          <ProfileMenuRow
            icon={<FontAwesome name="info-circle" size={18} color={ICON_MAIN} />}
            label="О приложении"
            onPress={() =>
              Alert.alert(
                'PodoCare',
                `Версия ${appVersion}\n\nСервис заботы о здоровье стоп и ногтей.`,
              )
            }
            rightAddon={
              <Text style={styles.versionBadge} lightColor="rgba(11,27,20,0.45)" darkColor="rgba(255,255,255,0.45)">
                {`v${appVersion}`}
              </Text>
            }
            showDivider
          />
          <Pressable
            onPress={() => setLogoutModalVisible(true)}
            disabled={loggingOut}
            style={({ pressed }) => [styles.logoutRow, pressed && styles.pressed]}
          >
            <FontAwesome name="sign-out" size={18} color="#BA1A1A" />
            <Text style={styles.logoutRowLabel} lightColor="#BA1A1A" darkColor="#FFB4A9">
              Выход
            </Text>
            <RNView style={styles.rowFlex} />
            <FontAwesome name="chevron-right" size={14} color="rgba(186,26,26,0.45)" />
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/(app)/(tabs)/booking')}
          style={({ pressed }) => [styles.ctaBanner, pressed && styles.pressed]}
        >
          <RNView style={styles.ctaTop}>
            <LeafLogo size={36} color="#B1F0CE" />
            <Text style={styles.ctaTitle} lightColor="#FFFFFF" darkColor="#FFFFFF">
              Ваше здоровье в надёжных руках
            </Text>
          </RNView>
          <View style={styles.ctaBtn} lightColor="#FFFFFF" darkColor="#FFFFFF">
            <Text style={styles.ctaBtnText} lightColor="#2D6A4F" darkColor="#2D6A4F">
              Записаться сейчас
            </Text>
          </View>
        </Pressable>

        <RNView style={{ height: 24 }} />
      </ScrollView>

      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !loggingOut && setLogoutModalVisible(false)}
      >
        <RNView style={styles.logoutModalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Закрыть"
            onPress={() => !loggingOut && setLogoutModalVisible(false)}
          />
          <RNView style={styles.logoutModalWrap} pointerEvents="box-none">
            <View style={styles.logoutCard} lightColor="#FFFFFF" darkColor="#14191C">
              <RNView style={styles.logoutIconCircle}>
                <FontAwesome name="sign-out" size={26} color={LOGOUT_RED} />
              </RNView>
              <Text style={styles.logoutModalTitle} lightColor="#1A1A2E" darkColor="#FFFFFF">
                Выйти из аккаунта?
              </Text>
              <Text
                style={styles.logoutModalSub}
                lightColor="rgba(112,121,115,1)"
                darkColor="rgba(149,163,160,0.9)"
              >
                Потребуется снова войти по номеру телефона
              </Text>
              <Pressable
                onPress={performLogout}
                disabled={loggingOut}
                style={({ pressed }) => [
                  styles.logoutModalPrimary,
                  loggingOut && styles.logoutModalPrimaryDisabled,
                  pressed && !loggingOut && styles.pressed,
                ]}
              >
                {loggingOut ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.logoutModalPrimaryText}>Выйти</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => !loggingOut && setLogoutModalVisible(false)}
                disabled={loggingOut}
                style={({ pressed }) => [styles.logoutModalSecondary, pressed && !loggingOut && styles.pressed]}
              >
                <Text style={styles.logoutModalSecondaryText} lightColor="#404943" darkColor="#95A39E">
                  Отмена
                </Text>
              </Pressable>
            </View>
          </RNView>
        </RNView>
      </Modal>
    </View>
  );
}

function ProfileMenuRow(props: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  showDivider?: boolean;
  rightAddon?: React.ReactNode;
}) {
  const { icon, label, onPress, showDivider, rightAddon } = props;
  return (
    <>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
        <RNView style={styles.menuIconSlot}>{icon}</RNView>
        <Text style={styles.menuLabel} lightColor="#1A1A2E" darkColor="#FFFFFF">
          {label}
        </Text>
        {rightAddon}
        <RNView style={styles.rowFlex} />
        <FontAwesome name="chevron-right" size={14} color={ICON_MUTED} />
      </Pressable>
      {showDivider ? <View style={styles.menuDivider} lightColor="rgba(149,163,160,0.25)" darkColor="rgba(255,255,255,0.08)" /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeTop: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  topBarSpacer: {
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    gap: 6,
  },
  heroLoader: {
    marginTop: 12,
  },
  avatarOuter: {
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(45,106,79,0.2)',
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImage: {
    ...StyleSheet.absoluteFillObject,
  },
  clientBadge: {
    marginTop: -14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(45,106,79,0.35)',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  clientBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  userName: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  userPhone: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sectionHeading: {
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  menuCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  menuIconSlot: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 54,
  },
  rowFlex: {
    flex: 1,
  },
  versionBadge: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    marginRight: 4,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  logoutRowLabel: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  ctaBanner: {
    marginTop: 22,
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#2D6A4F',
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#1A1A2E',
        shadowOpacity: 0.1,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 4 },
    }),
  },
  ctaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ctaTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  ctaBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  pressed: {
    opacity: 0.88,
  },
  logoutModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(26,26,46,0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  logoutModalWrap: {
    width: '100%',
    maxWidth: 400,
    zIndex: 1,
  },
  logoutCard: {
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.2)',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  logoutIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(186,26,26,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoutModalTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  logoutModalSub: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  logoutModalPrimary: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: LOGOUT_RED,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  logoutModalPrimaryDisabled: {
    opacity: 0.65,
  },
  logoutModalPrimaryText: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  logoutModalSecondary: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  logoutModalSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
