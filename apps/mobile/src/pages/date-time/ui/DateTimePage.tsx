import { router, useGlobalSearchParams, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { fetchBookingSlots, type BookingSlotsDayDto, type BookingSlotItemDto } from '@/features/booking/booking-api';
import { loadSelectedStudio } from '@/features/studio/local-studio-storage';
import { ApiError } from '@/shared/api/api-error';
import {
  decodeRouteIdParam,
  firstRouteParam,
  isUuid,
  sanitizeRouteParam,
} from '@/shared/navigation/route-params';
import { AppHeader } from '@/shared/ui/AppHeader';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

const MONTHS_RU_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatWeekdayRu(shortUpper: string): string {
  if (!shortUpper) return '';
  return shortUpper.charAt(0) + shortUpper.slice(1).toLowerCase();
}

function dayPartsFromApi(day: BookingSlotsDayDto): { weekday: string; dayNum: string; month: string } {
  const [, m, d] = day.date.split('-').map(Number);
  const mi = Number.isFinite(m) ? m - 1 : 0;
  return {
    weekday: formatWeekdayRu(day.weekdayShort),
    dayNum: String(d ?? ''),
    month: MONTHS_RU_SHORT[mi] ?? '',
  };
}

export function DateTimePage() {
  const insets = useSafeAreaInsets();
  const footerBottomPad = Math.max(insets.bottom, 16) + 8;

  const lp = useLocalSearchParams();
  const gp = useGlobalSearchParams();
  const specialistId = decodeRouteIdParam(firstRouteParam(lp.specialistId, gp.specialistId));
  const serviceId = decodeRouteIdParam(firstRouteParam(lp.serviceId, gp.serviceId));
  const specialistName = sanitizeRouteParam(firstRouteParam(lp.specialistName, gp.specialistName));
  const specialistTitle = sanitizeRouteParam(firstRouteParam(lp.specialistTitle, gp.specialistTitle));
  const serviceName = sanitizeRouteParam(firstRouteParam(lp.serviceName, gp.serviceName));
  const durationMinutes = sanitizeRouteParam(firstRouteParam(lp.durationMinutes, gp.durationMinutes));
  const priceMinor = sanitizeRouteParam(firstRouteParam(lp.priceMinor, gp.priceMinor));
  const currency = sanitizeRouteParam(firstRouteParam(lp.currency, gp.currency));

  const [studioId, setStudioId] = useState<string | null>(null);
  const [days, setDays] = useState<BookingSlotsDayDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dayKey, setDayKey] = useState<string | null>(null);
  const [slotKey, setSlotKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!specialistId || !serviceId) {
      setError('Не удалось получить специалиста или услугу из маршрута. Вернитесь назад и выберите снова.');
      setLoading(false);
      return;
    }
    if (!isUuid(specialistId) || !isUuid(serviceId)) {
      setError('Некорректная ссылка на запись. Вернитесь назад и выберите специалиста и услугу ещё раз.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const studio = await loadSelectedStudio();
      if (!studio?.id || !isUuid(studio.id)) {
        setError('Сначала выберите студию на главном экране');
        setStudioId(null);
        setDays([]);
        return;
      }
      setStudioId(studio.id);
      const res = await fetchBookingSlots({
        studioId: studio.id,
        specialistId,
        serviceId,
        days: 21,
      });
      setDays(res.days);
      const firstSelectable =
        res.days.find((x) => !x.disabled && x.slots.some((s) => s.available)) ??
        res.days.find((x) => !x.disabled) ??
        null;
      const dk = firstSelectable?.date ?? null;
      setDayKey(dk);
      const firstSlot =
        dk != null ? res.days.find((x) => x.date === dk)?.slots.find((s) => s.available) ?? null : null;
      setSlotKey(firstSlot?.startsAt ?? null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Не удалось загрузить расписание';
      setError(msg);
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, [specialistId, serviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const slotsForDay = useMemo((): BookingSlotItemDto[] => {
    if (!dayKey) return [];
    const row = days.find((d) => d.date === dayKey);
    return row?.slots ?? [];
  }, [days, dayKey]);

  const selectedSlot = slotKey ? slotsForDay.find((s) => s.startsAt === slotKey) : undefined;
  const canContinue =
    !!studioId && !!specialistId && !!serviceId && !!slotKey && !!selectedSlot?.available;

  const onContinue = () => {
    if (!canContinue || !slotKey || !selectedSlot?.available) return;
    router.push({
      pathname: '/(app)/booking-confirm',
      params: {
        specialistId: specialistId!,
        serviceId: serviceId!,
        startsAt: slotKey,
        ...(specialistName ? { specialistName } : {}),
        ...(specialistTitle ? { specialistTitle } : {}),
        ...(serviceName ? { serviceName } : {}),
        ...(durationMinutes ? { durationMinutes } : {}),
        ...(priceMinor ? { priceMinor } : {}),
        ...(currency ? { currency } : {}),
      },
    });
  };

  return (
    <View style={styles.root}>
      <AppHeader title="PodoCare" onBackPress={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + footerBottomPad + 56 }]}
      >
        <Text style={styles.context}>Дата и время</Text>
        <Text style={styles.h1}>Выберите дату</Text>

        {loading ? (
          <View style={styles.centerRow} lightColor="transparent" darkColor="transparent">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={styles.centerCol} lightColor="transparent" darkColor="transparent">
            <Text style={styles.err}>{error}</Text>
            <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
              <Text style={styles.retryText}>Повторить</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysRow}>
              {days.map((d) => {
                const { weekday, dayNum, month } = dayPartsFromApi(d);
                const active = d.date === dayKey;
                const muted = d.disabled;
                return (
                  <Pressable
                    key={d.date}
                    disabled={muted}
                    onPress={() => {
                      setDayKey(d.date);
                      const next =
                        d.slots.find((s) => s.available)?.startsAt ??
                        (d.slots.length ? d.slots[0].startsAt : null);
                      setSlotKey(next);
                    }}
                    style={({ pressed }) => [
                      styles.dayPill,
                      active && styles.dayPillActive,
                      muted && styles.dayPillMuted,
                      pressed && !muted && styles.pressed,
                    ]}
                  >
                    <Text
                      style={styles.dayWeek}
                      lightColor={active ? '#FFFFFF' : muted ? 'rgba(11,27,20,0.35)' : 'rgba(11,27,20,0.65)'}
                      darkColor={active ? '#06130E' : muted ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.70)'}
                    >
                      {weekday}
                    </Text>
                    <Text
                      style={styles.dayNum}
                      lightColor={active ? '#FFFFFF' : muted ? 'rgba(11,27,20,0.35)' : '#0B1B14'}
                      darkColor={active ? '#06130E' : muted ? 'rgba(255,255,255,0.35)' : '#FFFFFF'}
                    >
                      {dayNum}
                    </Text>
                    <Text
                      style={styles.dayMonth}
                      lightColor={active ? '#E9FFF5' : muted ? 'rgba(11,27,20,0.25)' : 'rgba(11,27,20,0.55)'}
                      darkColor={active ? '#2D6A4F' : muted ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.55)'}
                    >
                      {month}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
              <Text style={styles.sectionTitle}>Свободное время</Text>

              <View style={styles.slotsGrid} lightColor="transparent" darkColor="transparent">
                {slotsForDay.map((s) => {
                  const selected = s.startsAt === slotKey;
                  const disabled = !s.available;
                  return (
                    <Pressable
                      key={s.startsAt}
                      disabled={disabled}
                      onPress={() => setSlotKey(s.startsAt)}
                      style={({ pressed }) => [
                        styles.slot,
                        selected && styles.slotSelected,
                        disabled && styles.slotDisabled,
                        pressed && !disabled && styles.pressed,
                      ]}
                    >
                      <Text
                        style={styles.slotText}
                        lightColor={selected ? '#FFFFFF' : '#0B1B14'}
                        darkColor={selected ? '#06130E' : '#FFFFFF'}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {slotsForDay.length === 0 ? (
                <Text style={styles.emptySlots} lightColor="rgba(11,27,20,0.55)" darkColor="rgba(255,255,255,0.45)">
                  На этот день нет доступных слотов
                </Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      <SafeAreaPadding
        minTop={0}
        minBottom={0}
        style={[styles.footer, { paddingBottom: footerBottomPad }]}
        lightColor="#FFFFFF"
        darkColor="#0C1A14"
      >
        <Pressable
          onPress={onContinue}
          disabled={!canContinue}
          style={({ pressed }) => [
            styles.button,
            !canContinue && styles.buttonDisabled,
            pressed && canContinue && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText} lightColor="#FFFFFF" darkColor="#06130E">
            Продолжить
          </Text>
        </Pressable>
      </SafeAreaPadding>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  context: { fontSize: 13, fontWeight: '700', opacity: 0.65 },
  h1: { fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -0.6 },
  centerRow: { paddingVertical: 24, alignItems: 'center' },
  centerCol: { gap: 12, paddingVertical: 8 },
  err: { fontSize: 15, fontWeight: '600', opacity: 0.85 },
  retry: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
  },
  retryText: { color: '#FFFFFF', fontWeight: '800' },
  daysRow: { gap: 10, paddingVertical: 6, paddingRight: 16 },
  dayPill: {
    width: 72,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    backgroundColor: '#FFFFFF',
    gap: 2,
  },
  dayPillActive: {
    backgroundColor: '#2D6A4F',
    borderColor: 'rgba(45,106,79,0.55)',
  },
  dayPillMuted: {
    opacity: 0.45,
  },
  dayWeek: { fontSize: 12, fontWeight: '800' },
  dayNum: { fontSize: 18, fontWeight: '900' },
  dayMonth: { fontSize: 12, fontWeight: '700' },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slot: {
    width: '31%',
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotSelected: {
    backgroundColor: '#2D6A4F',
    borderColor: 'rgba(45,106,79,0.65)',
  },
  slotDisabled: {
    opacity: 0.35,
  },
  slotText: { fontSize: 14, fontWeight: '900' },
  emptySlots: { fontSize: 14, fontWeight: '600' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(149,163,160,0.25)',
  },
  button: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.85 },
});
