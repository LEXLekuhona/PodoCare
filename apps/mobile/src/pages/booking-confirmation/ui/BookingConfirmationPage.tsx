import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useGlobalSearchParams, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { createAppointment } from '@/features/booking/booking-api';
import { invalidateHomeNextAppointment } from '@/features/appointment/next-appointment-session';
import { loadSelectedStudio, type SelectedStudio } from '@/features/studio/local-studio-storage';
import { getMe } from '@/features/user/me-api';
import { ApiError } from '@/shared/api/api-error';
import { formatRuAppointmentDateTime } from '@/shared/lib/format-appointment';
import { formatMinorCurrency } from '@/shared/lib/format-money';
import {
  decodeRouteIdParam,
  firstRouteParam,
  isUuid,
  sanitizeRouteParam,
} from '@/shared/navigation/route-params';
import { AppHeader } from '@/shared/ui/AppHeader';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

const BRAND = '#0F5238';
const PRIMARY_CONTAINER = '#2D6A4F';
const SURFACE_BG = '#F8F9FA';
const SURFACE_LOW = '#F3F4F5';
const ON_SURFACE = '#191C1D';
const ON_SURFACE_VARIANT = '#404943';
const OUTLINE = '#707973';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

/** «14 ноября» → «14 Ноября» как в макете */
function formatConfirmDateShort(iso: string): string {
  const d = new Date(iso);
  const raw = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(d);
  const sp = raw.indexOf(' ');
  if (sp === -1) return raw.replace(/^./, (c) => c.toUpperCase());
  const day = raw.slice(0, sp);
  const month = raw.slice(sp + 1);
  return `${day} ${month.replace(/^./, (c) => c.toUpperCase())}`;
}

export function BookingConfirmationPage() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const footerBottomPad = Math.max(insets.bottom, 16);
  const buttonIconColor = colorScheme === 'dark' ? '#06130E' : '#FFFFFF';

  const lp = useLocalSearchParams();
  const gp = useGlobalSearchParams();

  const specialistId = decodeRouteIdParam(firstRouteParam(lp.specialistId, gp.specialistId));
  const serviceId = decodeRouteIdParam(firstRouteParam(lp.serviceId, gp.serviceId));
  const startsAt = sanitizeRouteParam(firstRouteParam(lp.startsAt, gp.startsAt));

  const specialistName =
    sanitizeRouteParam(firstRouteParam(lp.specialistName, gp.specialistName)) ?? 'Специалист';
  const specialistTitle = sanitizeRouteParam(firstRouteParam(lp.specialistTitle, gp.specialistTitle));
  const serviceName = sanitizeRouteParam(firstRouteParam(lp.serviceName, gp.serviceName)) ?? 'Услуга';
  const durationMinutesRaw = sanitizeRouteParam(firstRouteParam(lp.durationMinutes, gp.durationMinutes));
  const priceMinorRaw = sanitizeRouteParam(firstRouteParam(lp.priceMinor, gp.priceMinor));
  const currency = sanitizeRouteParam(firstRouteParam(lp.currency, gp.currency)) ?? 'RUB';

  const durationMinutes = useMemo(() => {
    const n = durationMinutesRaw != null ? Number(durationMinutesRaw) : NaN;
    return Number.isFinite(n) ? n : null;
  }, [durationMinutesRaw]);

  const priceMinor = useMemo(() => {
    const n = priceMinorRaw != null ? Number(priceMinorRaw) : NaN;
    return Number.isFinite(n) ? n : null;
  }, [priceMinorRaw]);

  const [studio, setStudio] = useState<SelectedStudio | null>(null);
  const [loadingStudio, setLoadingStudio] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingStudio(true);
      try {
        const s = await loadSelectedStudio();
        if (!cancelled) setStudio(s);
      } finally {
        if (!cancelled) setLoadingStudio(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dateLine = startsAt ? formatConfirmDateShort(startsAt) : '—';
  const timeLine = startsAt ? formatRuAppointmentDateTime(startsAt).timeLine : '—';

  const totalLabel =
    priceMinor != null ? formatMinorCurrency(priceMinor, currency) : '—';

  const canSubmit =
    !!studio?.id &&
    isUuid(studio.id) &&
    !!specialistId &&
    !!serviceId &&
    isUuid(specialistId) &&
    isUuid(serviceId) &&
    !!startsAt &&
    !submitting &&
    !loadingStudio;

  const onConfirm = useCallback(async () => {
    if (!canSubmit || !studio?.id || !specialistId || !serviceId || !startsAt) return;
    setSubmitting(true);
    try {
      const me = await getMe();
      await createAppointment({
        studioId: studio.id,
        specialistId,
        serviceId,
        clientUserId: me.id,
        startsAt,
      });
      await invalidateHomeNextAppointment(studio.id);
      router.replace({
        pathname: '/(app)/booking-created',
        params: {
          studioId: studio.id,
          startsAt,
          specialistName,
          ...(specialistTitle ? { specialistTitle } : {}),
          studioName: studio.name,
          studioAddress: studio.address,
        },
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Не удалось создать запись';
      Alert.alert('Ошибка', msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    studio?.id,
    studio?.name,
    studio?.address,
    specialistId,
    serviceId,
    startsAt,
    specialistName,
    specialistTitle,
  ]);

  const invalidBooking =
    !specialistId ||
    !serviceId ||
    !startsAt ||
    !isUuid(specialistId) ||
    !isUuid(serviceId);

  return (
    <View style={styles.root} lightColor={SURFACE_BG} darkColor="#06130E">
      <AppHeader
        title="Подтверждение"
        titleStyle={styles.headerTitle}
        onBackPress={() => router.back()}
      />

      {invalidBooking ? (
        <View style={styles.bannerErr} lightColor="transparent" darkColor="transparent">
          <Text style={styles.bannerErrText} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.6)">
            Не удалось загрузить данные записи. Вернитесь и выберите дату ещё раз.
          </Text>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.bannerBtn, pressed && styles.pressed]}>
            <Text style={styles.bannerBtnText}>Назад</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 + footerBottomPad }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
              <RNView style={styles.studioRow}>
                <View style={styles.studioIconWrap} lightColor={SURFACE_LOW} darkColor="rgba(255,255,255,0.08)">
                  <FontAwesome name="building" size={22} color={PRIMARY_CONTAINER} />
                </View>
                <View style={styles.studioTextCol} lightColor="transparent" darkColor="transparent">
                  <Text style={styles.studioName} lightColor={ON_SURFACE} darkColor="#F5FBF7">
                    {loadingStudio ? '…' : studio?.name ?? 'Студия'}
                  </Text>
                  <Text style={styles.studioAddr} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.55)">
                    {loadingStudio ? '…' : studio?.address ?? '—'}
                  </Text>
                </View>
              </RNView>

              <View style={styles.specialistBar} lightColor={SURFACE_LOW} darkColor="rgba(255,255,255,0.08)">
                <RNView style={styles.avatar}>
                  <Text style={styles.avatarText} lightColor={PRIMARY_CONTAINER} darkColor="#95D4B3">
                    {initialsFromName(specialistName)}
                  </Text>
                </RNView>
                <View style={styles.specialistText} lightColor="transparent" darkColor="transparent">
                  <Text style={styles.captionUpper} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.5)">
                    Специалист
                  </Text>
                  <Text style={styles.specialistName} lightColor={ON_SURFACE} darkColor="#F5FBF7">
                    {specialistName}
                  </Text>
                </View>
              </View>

              <RNView style={styles.divider} />

              <RNView style={styles.serviceRow}>
                <View style={styles.serviceLeft} lightColor="transparent" darkColor="transparent">
                  <Text style={styles.serviceTitle} lightColor={ON_SURFACE} darkColor="#F5FBF7">
                    {serviceName}
                  </Text>
                  <Text style={styles.duration} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.55)">
                    {durationMinutes != null ? `${durationMinutes} мин` : '—'}
                  </Text>
                </View>
                <Text style={styles.price} lightColor={ON_SURFACE} darkColor="#F5FBF7">
                  {totalLabel}
                </Text>
              </RNView>

              <RNView style={styles.dtRow}>
                <View style={styles.dtBox} lightColor={SURFACE_LOW} darkColor="rgba(255,255,255,0.08)">
                  <FontAwesome name="calendar" size={18} color={OUTLINE} />
                  <View style={styles.dtText} lightColor="transparent" darkColor="transparent">
                    <Text style={styles.dtLabel} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.5)">
                      Дата
                    </Text>
                    <Text style={styles.dtValue} lightColor={ON_SURFACE} darkColor="#F5FBF7">
                      {dateLine}
                    </Text>
                  </View>
                </View>
                <View style={styles.dtBox} lightColor={SURFACE_LOW} darkColor="rgba(255,255,255,0.08)">
                  <FontAwesome name="clock-o" size={18} color={OUTLINE} />
                  <View style={styles.dtText} lightColor="transparent" darkColor="transparent">
                    <Text style={styles.dtLabel} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.5)">
                      Время
                    </Text>
                    <Text style={styles.dtValue} lightColor={ON_SURFACE} darkColor="#F5FBF7">
                      {timeLine}
                    </Text>
                  </View>
                </View>
              </RNView>
            </View>
          </ScrollView>

          <SafeAreaPadding
            minTop={0}
            minBottom={0}
            style={[styles.footer, { paddingBottom: footerBottomPad }]}
            lightColor="rgba(255,255,255,0.96)"
            darkColor="#0C1A14"
          >
            <RNView style={styles.totalRow}>
              <Text style={styles.totalCaption} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.55)">
                Итого к оплате
              </Text>
              <Text style={styles.totalAmount} lightColor={ON_SURFACE} darkColor="#F5FBF7">
                {totalLabel}
              </Text>
            </RNView>
            <Pressable
              onPress={() => void onConfirm()}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.buttonWrap,
                !canSubmit && styles.buttonDisabled,
                pressed && canSubmit && styles.buttonPressed,
              ]}
            >
              <LinearGradient
                colors={[BRAND, PRIMARY_CONTAINER]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
              >
                {submitting ? (
                  <ActivityIndicator color={buttonIconColor} />
                ) : (
                  <Text style={styles.buttonText} lightColor="#FFFFFF" darkColor="#06130E">
                    Подтвердить запись
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </SafeAreaPadding>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerTitle: {
    color: '#2D6A4F',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 18,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 2 },
  },
  studioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  studioIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studioTextCol: { flex: 1, gap: 4 },
  studioName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    letterSpacing: -0.3,
  },
  studioAddr: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  specialistBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 12,
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(45, 106, 79, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  specialistText: { flex: 1, gap: 2 },
  captionUpper: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  specialistName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(191, 201, 193, 0.35)',
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 4,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(191, 201, 193, 0.35)',
  },
  serviceLeft: { flex: 1, gap: 4 },
  serviceTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
  },
  duration: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  price: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
  },
  dtRow: {
    flexDirection: 'column',
    gap: 10,
    paddingTop: 4,
  },
  dtBox: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 12,
  },
  dtText: { gap: 2 },
  dtLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  dtValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(191, 201, 193, 0.25)',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  totalCaption: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  totalAmount: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 24,
    letterSpacing: -0.5,
  },
  buttonWrap: { borderRadius: 12, overflow: 'hidden' },
  button: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.92 },
  buttonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
  },
  bannerErr: {
    padding: 20,
    gap: 12,
  },
  bannerErrText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    lineHeight: 22,
  },
  bannerBtn: {
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY_CONTAINER,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  bannerBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  pressed: { opacity: 0.88 },
});
