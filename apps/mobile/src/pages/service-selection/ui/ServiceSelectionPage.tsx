import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import {
  fetchSpecialistServices,
  fetchStudioServices,
  type StudioServiceDto,
} from '@/features/booking/booking-api';
import { loadSelectedStudio } from '@/features/studio/local-studio-storage';
import { ApiError } from '@/shared/api/api-error';
import { sanitizeRouteParam } from '@/shared/navigation/route-params';
import { AppHeader } from '@/shared/ui/AppHeader';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

const BRAND = '#0F5238';
const PRIMARY_CONTAINER = '#2D6A4F';
const SURFACE = '#FFFFFF';

type ServiceIcon = 'stethoscope' | 'leaf' | 'scissors' | 'medkit';

const ICONS: ServiceIcon[] = ['stethoscope', 'leaf', 'scissors', 'medkit'];

type ServiceRow = StudioServiceDto & {
  title: string;
  duration: string;
  icon: ServiceIcon;
};

export function ServiceSelectionPage() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const footerBottomPad = Math.max(insets.bottom, 16) + 8;
  const buttonIconColor = colorScheme === 'dark' ? '#06130E' : '#FFFFFF';

  const specialistId = sanitizeRouteParam(useLocalSearchParams().specialistId);
  const specialistName = sanitizeRouteParam(useLocalSearchParams().specialistName);
  const specialistTitle = sanitizeRouteParam(useLocalSearchParams().specialistTitle);
  const prefillServiceId = sanitizeRouteParam(useLocalSearchParams().prefillServiceId);

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const studio = await loadSelectedStudio();
      if (!studio?.id) {
        setServices([]);
        setSelectedId(null);
        setLoadError('Сначала выберите студию на главном экране');
        return;
      }
      const list =
        specialistId != null
          ? await fetchSpecialistServices(studio.id, specialistId)
          : await fetchStudioServices(studio.id);
      const rows: ServiceRow[] = list.map((s, i) => ({
        ...s,
        title: s.name,
        duration: `${s.durationMinutes} мин`,
        icon: ICONS[i % ICONS.length]!,
      }));
      setServices(rows);
      const preferred =
        prefillServiceId != null && rows.some((r) => r.id === prefillServiceId)
          ? prefillServiceId
          : (rows[0]?.id ?? null);
      setSelectedId(preferred);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Не удалось загрузить услуги';
      setLoadError(msg);
      setServices([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [specialistId, prefillServiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => services.find((s) => s.id === selectedId) ?? null, [services, selectedId]);

  const introLead = specialistId
    ? 'Пожалуйста, выберите процедуру, которая вам необходима. Наш специалист проведет предварительный осмотр перед началом.'
    : 'Выберите услугу и перейдите к специалистам — покажем только тех мастеров, кто её оказывает.';

  return (
    <View style={styles.root} lightColor="#FFFFFF" darkColor="#06130E">
      <AppHeader title="Solodova Recovery System" onBackPress={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + footerBottomPad + 56 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro} lightColor="transparent" darkColor="transparent">
          <RNView style={styles.titleWrap}>
            <Text style={styles.h1}>Выберите услугу</Text>
          </RNView>
          <Text style={styles.lead} lightColor="rgba(64,73,67,1)" darkColor="rgba(255,255,255,0.65)">
            {introLead}
          </Text>
        </View>

        <View style={styles.list} lightColor="transparent" darkColor="transparent">
          {loading ? (
            <View style={styles.loader} lightColor="transparent" darkColor="transparent">
              <ActivityIndicator />
            </View>
          ) : loadError ? (
            <View style={styles.errBlock} lightColor="transparent" darkColor="transparent">
              <Text style={styles.errText} lightColor="rgba(64,73,67,1)" darkColor="rgba(255,255,255,0.65)">
                {loadError}
              </Text>
              <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryBtn, pressed && styles.buttonPressed]}>
                <Text style={styles.retryLabel}>Обновить</Text>
              </Pressable>
            </View>
          ) : (
            services.map((s) => {
              const active = s.id === selectedId;
              const desc = s.description?.trim() || 'Описание уточним на приёме.';
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedId(s.id)}
                  style={({ pressed }) => [
                    styles.cardShadow,
                    pressed && !active && styles.cardShadowPressed,
                    pressed && active && styles.cardPressedActive,
                  ]}
                >
                  <View
                    style={[styles.card, active && styles.cardActive]}
                    lightColor={SURFACE}
                    darkColor="#0C1A14"
                  >
                    {active ? (
                      <LinearGradient
                        pointerEvents="none"
                        colors={['rgba(15,82,56,0.06)', 'rgba(15,82,56,0.00)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.cardGradient}
                      />
                    ) : null}

                    <RNView style={[styles.iconWrap, active ? styles.iconWrapActive : styles.iconWrapIdle]}>
                      <FontAwesome name={s.icon} size={22} color={active ? BRAND : 'rgba(64,73,67,1)'} />
                    </RNView>

                    <View style={styles.cardBody} lightColor="transparent" darkColor="transparent">
                      <RNView style={styles.cardTitleRow}>
                        <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>{s.title}</Text>
                        <RNView style={[styles.radio, active && styles.radioActive]}>
                          {active ? <FontAwesome name="check" size={12} color="#FFFFFF" /> : null}
                        </RNView>
                      </RNView>
                      <Text style={styles.desc} lightColor="rgba(64,73,67,1)" darkColor="rgba(255,255,255,0.65)">
                        {desc}
                      </Text>
                      <RNView style={styles.metaRow}>
                        <FontAwesome name="clock-o" size={18} color="rgba(64,73,67,1)" />
                        <Text style={styles.duration} lightColor="rgba(64,73,67,1)" darkColor="rgba(255,255,255,0.72)">
                          {s.duration}
                        </Text>
                      </RNView>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <SafeAreaPadding
        minTop={0}
        minBottom={0}
        style={[styles.footer, { paddingBottom: footerBottomPad }]}
        lightColor="#FFFFFF"
        darkColor="#0C1A14"
      >
        <Pressable
          onPress={() => {
            if (specialistId) {
              if (!selected) return;
              router.push({
                pathname: '/(app)/date-time',
                params: {
                  specialistId,
                  serviceId: selected.id,
                  ...(specialistName ? { specialistName } : {}),
                  ...(specialistTitle ? { specialistTitle } : {}),
                  serviceName: selected.title,
                  durationMinutes: String(selected.durationMinutes),
                  priceMinor: String(selected.priceMinor),
                  currency: selected.currency,
                },
              });
              return;
            }
            if (!selected) return;
            router.push({
              pathname: '/(app)/specialists',
              params: {
                serviceId: selected.id,
                serviceName: selected.title,
              },
            });
          }}
          disabled={loading || !selected}
          style={({ pressed }) => [
            styles.buttonWrap,
            (loading || !selected) && styles.buttonDisabled,
            pressed && !loading && !!selected && styles.buttonPressed,
          ]}
        >
          <LinearGradient
            colors={[BRAND, PRIMARY_CONTAINER]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            <Text style={styles.buttonText} lightColor="#FFFFFF" darkColor="#06130E">
              {specialistId ? 'К расписанию' : 'Выбрать специалиста'}
            </Text>
            <FontAwesome name="arrow-right" size={20} color={buttonIconColor} />
          </LinearGradient>
        </Pressable>
      </SafeAreaPadding>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  intro: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  titleWrap: {
    width: '100%',
    alignItems: 'center',
  },
  h1: {
    textAlign: 'center',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: BRAND,
  },
  lead: {
    width: '100%',
    alignSelf: 'stretch',
    textAlign: 'left',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  list: {
    gap: 16,
  },
  loader: { paddingVertical: 32, alignItems: 'center' },
  errBlock: { gap: 12, paddingVertical: 8 },
  errText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: BRAND,
  },
  retryLabel: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  cardShadow: {
    borderRadius: 16,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  /** Невыбранная карточка: сильнее тень при нажатии (аналог hover в Stitch). */
  cardShadowPressed: {
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  cardPressedActive: {
    opacity: 0.96,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(191,201,193,0.30)',
    /* `overflow: hidden` в flex-ряду на Android часто даёт обрезанный/кривой перенос текста в соседней колонке */
    overflow: 'visible',
    position: 'relative',
  },
  cardActive: {
    borderWidth: 2,
    borderColor: BRAND,
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(177,240,206,1)',
  },
  iconWrapIdle: {
    backgroundColor: 'rgba(231,232,233,1)',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  cardTitleActive: {
    color: BRAND,
  },
  desc: {
    alignSelf: 'stretch',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  duration: {
    fontSize: 13,
    fontWeight: '500',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(191,201,193,1)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    opacity: 0.5,
  },
  radioActive: {
    borderColor: BRAND,
    backgroundColor: BRAND,
    opacity: 1,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(191,201,193,0.20)',
  },
  buttonWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: BRAND,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  button: {
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.88 },
  buttonText: { fontSize: 16, fontWeight: '800' },
});
