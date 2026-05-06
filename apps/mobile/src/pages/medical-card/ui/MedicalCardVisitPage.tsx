import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { fetchMedicalCard, type MedicalCardHistoryItemDto } from '@/features/medical-card/medical-card-api';
import { ApiError } from '@/shared/api/api-error';
import { sanitizeRouteParam } from '@/shared/navigation/route-params';
import { AppHeader } from '@/shared/ui/AppHeader';

export function MedicalCardVisitPage() {
  const id = sanitizeRouteParam(useLocalSearchParams().id);
  const [visit, setVisit] = useState<MedicalCardHistoryItemDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const card = await fetchMedicalCard();
      const next = card.history.find((item) => item.id === id) ?? card.history[0] ?? null;
      setVisit(next);
      if (!next) setError('Визит не найден');
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Не удалось загрузить карточку визита';
      setError(message);
      setVisit(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const nextVisitLabel = useMemo(() => {
    if (!visit?.startsAt) return 'по рекомендации врача';
    const date = new Date(visit.startsAt);
    if (Number.isNaN(date.getTime())) return 'по рекомендации врача';
    date.setDate(date.getDate() + 30);
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long' }).format(date);
  }, [visit?.startsAt]);

  return (
    <View style={styles.root} lightColor="#F6F7F8" darkColor="#06130E">
      <AppHeader
        title="Медицинская карта"
        titleStyle={styles.title}
        onBackPress={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
            <ActivityIndicator />
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
            <Text style={styles.errorText} lightColor="#93000A" darkColor="#FFB4A9">
              {error}
            </Text>
            <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
              <Text style={styles.retryBtnText}>Обновить</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && visit ? (
          <>
        <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
          <RNView style={styles.topRow}>
            <Text style={styles.cardTitle}>Карточка визита</Text>
            <View style={styles.doneBadge} lightColor="rgba(45,106,79,0.14)" darkColor="rgba(149,212,179,0.2)">
              <FontAwesome name="check-circle" size={12} color="#2D6A4F" />
              <Text style={styles.doneBadgeText}>Завершен</Text>
            </View>
          </RNView>
          <Text style={styles.mutedText} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.9)">
            {formatDate(visit.startsAt)}
          </Text>
          <RNView style={styles.personRow}>
            <RNView style={styles.avatarFallback}>
              <FontAwesome name="user-md" size={20} color="#2D6A4F" />
            </RNView>
            <RNView style={styles.personMeta}>
              <Text style={styles.personName}>{visit.specialistName}</Text>
              <Text style={styles.mutedText} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.9)">
                {visit.specialistRole}
              </Text>
            </RNView>
          </RNView>
          <View style={styles.serviceBox} lightColor="#F4F6F5" darkColor="rgba(255,255,255,0.08)">
            <Text style={styles.serviceLabel} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.9)">
              Услуга
            </Text>
            <Text style={styles.serviceValue}>{visit.serviceLabel}</Text>
          </View>
        </View>

        <SectionCard title="Диагноз" icon="plus-square">
          {toReadable(visit.diagnosis)}
        </SectionCard>

        <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
          <RNView style={styles.sectionHeader}>
            <FontAwesome name="check-circle-o" size={16} color="#2D6A4F" />
            <Text style={styles.sectionTitle}>Что сделано</Text>
          </RNView>
          <RNView style={styles.listCol}>
            {visit.actions.length > 0 ? visit.actions.map((item) => (
              <RNView key={item} style={styles.listRow}>
                <FontAwesome name="check-circle" size={12} color="#6FCF97" />
                <Text style={styles.sectionBody}>{item}</Text>
              </RNView>
            )) : (
              <Text style={styles.sectionBody}>Данные не добавлены.</Text>
            )}
          </RNView>
        </View>

        <SectionCard title="Рекомендации" icon="lightbulb-o">
          {toReadable(visit.recommendations)}
        </SectionCard>

        <Pressable onPress={() => router.push('/(app)/(tabs)/booking')} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <FontAwesome name="calendar-check-o" size={18} color="#D9F5E7" />
          <Text style={styles.ctaTextTop}>Следующий визит</Text>
          <Text style={styles.ctaTextMain}>{nextVisitLabel}</Text>
          <View style={styles.ctaButton} lightColor="#FFFFFF" darkColor="#FFFFFF">
            <Text style={styles.ctaButtonText}>Записаться</Text>
          </View>
        </Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SectionCard(props: { title: string; icon: keyof typeof FontAwesome.glyphMap; children: string }) {
  return (
    <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
      <RNView style={styles.sectionHeader}>
        <FontAwesome name={props.icon} size={16} color="#2D6A4F" />
        <Text style={styles.sectionTitle}>{props.title}</Text>
      </RNView>
      <Text style={styles.sectionBody}>{props.children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  title: {
    color: '#1C6B52',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 26,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
  },
  retryBtn: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#2D6A4F',
  },
  retryBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  card: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: '#1A1A2E',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  doneBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D6A4F',
    fontFamily: 'Inter_700Bold',
  },
  mutedText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45,106,79,0.12)',
  },
  personMeta: {
    gap: 2,
  },
  personName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    fontFamily: 'Inter_700Bold',
  },
  serviceBox: {
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  serviceLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  serviceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    fontFamily: 'Inter_700Bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    color: '#1A1A2E',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(11,27,20,0.78)',
    fontFamily: 'Inter_500Medium',
  },
  listCol: {
    gap: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cta: {
    marginTop: 6,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: '#1D6D4C',
    gap: 6,
  },
  ctaTextTop: {
    fontSize: 14,
    color: 'rgba(217,245,231,0.95)',
    fontFamily: 'Inter_500Medium',
  },
  ctaTextMain: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  ctaButton: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 26,
    paddingVertical: 10,
    minWidth: 184,
    alignItems: 'center',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1D6D4C',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  pressed: {
    opacity: 0.9,
  },
});

function toReadable(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? text : 'Не указано.';
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
