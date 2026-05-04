import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useGlobalSearchParams, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { invalidateHomeNextAppointment } from '@/features/appointment/next-appointment-session';
import { formatRuAppointmentDateTime } from '@/shared/lib/format-appointment';
import { firstRouteParam, sanitizeRouteParam } from '@/shared/navigation/route-params';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

const BRAND = '#0F5238';
const PRIMARY_CONTAINER = '#2D6A4F';
const SURFACE = '#F8F9FA';
const SURFACE_LOW = '#F3F4F5';
const ON_SURFACE = '#191C1D';
const ON_SURFACE_VARIANT = '#404943';
const OUTLINE = '#707973';

function formatDateLineRu(iso: string): string {
  const d = new Date(iso);
  const raw = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(d);
  const sp = raw.indexOf(' ');
  if (sp === -1) return raw.replace(/^./, (c) => c.toUpperCase());
  const day = raw.slice(0, sp);
  const month = raw.slice(sp + 1);
  return `${day} ${month.replace(/^./, (c) => c.toUpperCase())}`;
}

function formatWeekdayLongRu(iso: string): string {
  const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(new Date(iso));
  return wd.replace(/^./, (c) => c.toUpperCase());
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

async function goHomeTabs(studioId?: string): Promise<void> {
  await invalidateHomeNextAppointment(studioId);
  router.dismissTo('/(app)/(tabs)');
}

export function BookingCreatedPage() {
  const lp = useLocalSearchParams();
  const gp = useGlobalSearchParams();

  const startsAt = sanitizeRouteParam(firstRouteParam(lp.startsAt, gp.startsAt));
  const specialistName =
    sanitizeRouteParam(firstRouteParam(lp.specialistName, gp.specialistName)) ?? 'Специалист';
  const specialistTitle =
    sanitizeRouteParam(firstRouteParam(lp.specialistTitle, gp.specialistTitle)) ?? '';
  const studioId = sanitizeRouteParam(firstRouteParam(lp.studioId, gp.studioId)) ?? undefined;
  const studioName = sanitizeRouteParam(firstRouteParam(lp.studioName, gp.studioName)) ?? 'Студия';
  const studioAddress = sanitizeRouteParam(firstRouteParam(lp.studioAddress, gp.studioAddress)) ?? '';

  const dateOnly = useMemo(() => (startsAt ? formatDateLineRu(startsAt) : '—'), [startsAt]);
  const timeOnly = useMemo(() => (startsAt ? formatRuAppointmentDateTime(startsAt).timeLine : '—'), [startsAt]);
  const weekdayLine = useMemo(() => (startsAt ? formatWeekdayLongRu(startsAt) : ''), [startsAt]);

  const invalid = !startsAt;

  return (
    <View style={styles.root} lightColor={SURFACE} darkColor="#06130E">
      <SafeAreaPadding minTop={16} minBottom={0} style={styles.safeTop} lightColor="transparent" darkColor="transparent">
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {invalid ? (
            <View style={styles.errWrap} lightColor="transparent" darkColor="transparent">
              <Text style={styles.errText} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.6)">
                Нет данных о записи.
              </Text>
              <Pressable onPress={() => void goHomeTabs(studioId)} style={({ pressed }) => [styles.goBtn, pressed && styles.pressed]}>
                <Text style={styles.goBtnText}>На главную</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <RNView style={styles.iconOuter}>
                <RNView style={styles.iconGlow} />
                <RNView style={styles.iconCircle}>
                  <FontAwesome name="check-circle" size={52} color={BRAND} />
                </RNView>
              </RNView>

              <View style={styles.headBlock} lightColor="transparent" darkColor="transparent">
                <Text style={styles.h1} lightColor={PRIMARY_CONTAINER} darkColor="#95D4B3">
                  Запись создана!
                </Text>
                <Text style={styles.sub} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.55)">
                  Напомним за 24 часа и за 2 часа до визита
                </Text>
              </View>

              <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
                <RNView style={styles.cardRow}>
                  <View style={styles.iconBox} lightColor={SURFACE_LOW} darkColor="rgba(255,255,255,0.08)">
                    <FontAwesome name="calendar" size={22} color={PRIMARY_CONTAINER} />
                  </View>
                  <View style={styles.cardCol} lightColor="transparent" darkColor="transparent">
                    <Text style={styles.dateBold} lightColor={ON_SURFACE} darkColor="#F5FBF7">
                      {dateOnly}
                    </Text>
                    <Text style={styles.timeBold} lightColor={ON_SURFACE} darkColor="#F5FBF7">
                      {timeOnly}
                    </Text>
                    {weekdayLine ? (
                      <Text style={styles.weekdayMuted} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.5)">
                        {weekdayLine}
                      </Text>
                    ) : null}
                  </View>
                </RNView>

                <RNView style={styles.divider} />

                <RNView style={styles.cardRowCenter}>
                  <RNView style={styles.avatar}>
                    <Text style={styles.avatarTxt} lightColor={PRIMARY_CONTAINER} darkColor="#95D4B3">
                      {initialsFromName(specialistName)}
                    </Text>
                  </RNView>
                  <View style={styles.cardCol} lightColor="transparent" darkColor="transparent">
                    <Text style={styles.specName} lightColor={ON_SURFACE} darkColor="#F5FBF7">
                      {specialistName}
                    </Text>
                    <Text style={styles.specTitle} lightColor={OUTLINE} darkColor="rgba(255,255,255,0.45)">
                      {specialistTitle.trim() ? specialistTitle : 'Специалист'}
                    </Text>
                  </View>
                </RNView>

                <RNView style={styles.divider} />

                <RNView style={styles.cardRow}>
                  <View style={styles.iconBox} lightColor={SURFACE_LOW} darkColor="rgba(255,255,255,0.08)">
                    <FontAwesome name="map-marker" size={22} color={PRIMARY_CONTAINER} />
                  </View>
                  <View style={styles.cardCol} lightColor="transparent" darkColor="transparent">
                    <Text style={styles.locName} lightColor={ON_SURFACE} darkColor="#F5FBF7">
                      {studioName}
                    </Text>
                    <Text style={styles.locAddr} lightColor={OUTLINE} darkColor="rgba(255,255,255,0.45)">
                      {studioAddress || '—'}
                    </Text>
                  </View>
                </RNView>
              </View>

              <View style={styles.actions} lightColor="transparent" darkColor="transparent">
                <Pressable onPress={() => void goHomeTabs(studioId)} style={({ pressed }) => [styles.primaryWrap, pressed && styles.pressed]}>
                  <LinearGradient
                    colors={[BRAND, PRIMARY_CONTAINER]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryBtn}
                  >
                    <Text style={styles.primaryBtnText} lightColor="#FFFFFF" darkColor="#06130E">
                      Мои записи
                    </Text>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={() => void goHomeTabs(studioId)} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
                  <Text style={styles.secondaryBtnText} lightColor={ON_SURFACE} darkColor="#F5FBF7">
                    На главную
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaPadding>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeTop: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  iconOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(177, 240, 206, 0.35)',
    transform: [{ scale: 1.15 }],
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(177, 240, 206, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B1F0CE',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
  },
  headBlock: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  h1: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 28,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  sub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 280,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 22,
    gap: 16,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(191, 201, 193, 0.35)',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  cardRowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCol: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  dateBold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    letterSpacing: -0.3,
  },
  timeBold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    letterSpacing: -0.3,
  },
  weekdayMuted: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(225, 227, 228, 0.9)',
    width: '100%',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: 'rgba(225, 227, 228, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarTxt: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  specName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  specTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  locName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  locAddr: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  primaryWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
  },
  primaryBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  secondaryBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
  },
  errWrap: { gap: 14, alignItems: 'center', paddingVertical: 40 },
  errText: { fontFamily: 'Inter_500Medium', fontSize: 15, textAlign: 'center' },
  goBtn: {
    backgroundColor: PRIMARY_CONTAINER,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
  },
  goBtnText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 15 },
  pressed: { opacity: 0.9 },
});
