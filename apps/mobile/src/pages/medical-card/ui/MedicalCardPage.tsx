import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { fetchMedicalCard, type MedicalCardDto } from '@/features/medical-card/medical-card-api';
import { ApiError } from '@/shared/api/api-error';
import { AppHeader } from '@/shared/ui/AppHeader';

type TabKey = 'basic' | 'specialist' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'basic', label: 'Основное' },
  { key: 'specialist', label: 'От специалиста' },
  { key: 'history', label: 'История' },
];

export function MedicalCardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MedicalCardDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchMedicalCard();
      setData(next);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Не удалось загрузить медкарту';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeTabContent = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.stateWrap} lightColor="transparent" darkColor="transparent">
          <ActivityIndicator />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
          <Text style={styles.errorText} lightColor="#93000A" darkColor="#FFB4A9">
            {error}
          </Text>
          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
            <Text style={styles.retryBtnText}>Обновить</Text>
          </Pressable>
        </View>
      );
    }

    const basics = data?.basics;
    const specialist = data?.specialist;
    const history = data?.history ?? [];

    if (activeTab === 'basic') {
      return (
        <>
          <Card title="Дата рождения" icon="calendar-o">
            {formatDate(basics?.birthDate)}
          </Card>
          <Card title="Аллергии" icon="warning">
            {toReadable(basics?.allergies)}
          </Card>
          <Card title="Хронические заболевания" icon="medkit">
            {toReadable(basics?.chronicConditions)}
          </Card>
          <Card title="Противопоказания" icon="shield">
            {toReadable(basics?.contraindications)}
          </Card>
        </>
      );
    }

    if (activeTab === 'specialist') {
      return (
        <>
          <Card title="Противопоказания" icon="warning">
            {toReadable(specialist?.contraindications)}
          </Card>
          <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
            <RNView style={styles.cardHeader}>
              <FontAwesome name="list-ol" size={16} color="#2D6A4F" />
              <Text style={styles.cardTitleShort}>План лечения</Text>
            </RNView>
            <RNView style={styles.planList}>
              {(specialist?.plan ?? []).slice(0, 3).map((item, index) => (
                <RNView key={item} style={styles.planRow}>
                  <RNView style={styles.planDot}>
                    <Text style={styles.planDotText}>{index + 1}</Text>
                  </RNView>
                  <Text style={styles.cardValue} lightColor="rgba(11,27,20,0.75)" darkColor="rgba(255,255,255,0.75)">
                    {item}
                  </Text>
                </RNView>
              ))}
            </RNView>
            {(specialist?.plan ?? []).length === 0 ? (
              <Text style={styles.cardValue} lightColor="rgba(11,27,20,0.75)" darkColor="rgba(255,255,255,0.75)">
                План лечения пока не добавлен.
              </Text>
            ) : null}
          </View>
          <Card title="Рекомендации врача" icon="stethoscope">
            {toReadable(specialist?.recommendations)}
          </Card>
          {specialist?.filledAt ? (
            <Text style={styles.footnote} lightColor="rgba(112,121,115,0.9)" darkColor="rgba(149,163,160,0.8)">
              Карта заполнена специалистом {formatDate(specialist.filledAt)}.
            </Text>
          ) : null}
        </>
      );
    }

    if (history.length === 0) {
      return (
        <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
          <Text style={styles.cardValue} lightColor="rgba(11,27,20,0.75)" darkColor="rgba(255,255,255,0.75)">
            История визитов пока пуста.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.timelineWrap} lightColor="transparent" darkColor="transparent">
        {history.map((visit, index) => (
          <RNView key={visit.id} style={styles.timelineRow}>
            <RNView style={styles.timelineRail}>
              <RNView style={[styles.timelineDot, index === 0 ? styles.timelineDotActive : null]} />
              {index < history.length - 1 ? <RNView style={styles.timelineLine} /> : null}
            </RNView>
            <Pressable
              onPress={() => router.push(`/(app)/medical-card/visit/${visit.id}`)}
              style={({ pressed }) => [styles.visitCardPressable, pressed && styles.pressed]}
            >
              <View style={styles.visitCard} lightColor="#FFFFFF" darkColor="#0C1A14">
                <Text style={styles.visitDate} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.9)">
                  {formatDate(visit.startsAt)}
                </Text>
                <Text style={styles.visitName}>{visit.specialistName}</Text>
                <Text style={styles.visitRole} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.9)">
                  {visit.specialistRole}
                </Text>
                <RNView style={styles.badgeRow}>
                  <View style={styles.serviceBadge} lightColor="#F1F4F2" darkColor="rgba(255,255,255,0.08)">
                    <Text style={styles.serviceBadgeText} lightColor="rgba(65,72,69,1)" darkColor="rgba(149,163,160,0.95)">
                      {visit.serviceLabel}
                    </Text>
                  </View>
                  <FontAwesome name="chevron-right" size={14} color="rgba(112,121,115,1)" />
                </RNView>
                <Text style={styles.summary} numberOfLines={2}>
                  Краткий итог: {toReadable(visit.summary)}
                </Text>
              </View>
            </Pressable>
          </RNView>
        ))}
      </View>
    );
  }, [activeTab, data, error, load, loading]);

  return (
    <View style={styles.root} lightColor="#F6F7F8" darkColor="#06130E">
      <AppHeader
        title="Медицинская карта"
        titleStyle={styles.title}
        onBackPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(app)/(tabs)/profile');
        }}
      />

      <RNView style={styles.tabsRow}>
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={({ pressed }) => [styles.tabBtn, active && styles.tabBtnActive, pressed && styles.pressed]}
            >
              <Text
                style={styles.tabLabel}
                lightColor={active ? '#2D6A4F' : 'rgba(112,121,115,1)'}
                darkColor={active ? '#95D4B3' : 'rgba(149,163,160,0.9)'}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </RNView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeTabContent}
      </ScrollView>
    </View>
  );
}

function Card(props: { title: string; icon: keyof typeof FontAwesome.glyphMap; children: string }) {
  return (
    <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
      <RNView style={styles.cardHeader}>
        <FontAwesome name={props.icon} size={16} color="#2D6A4F" />
        <Text style={styles.cardTitle}>{props.title}</Text>
      </RNView>
      <View style={styles.valueWrap} lightColor="#F5F7F6" darkColor="rgba(255,255,255,0.08)">
        <Text style={styles.cardValue} lightColor="rgba(11,27,20,0.75)" darkColor="rgba(255,255,255,0.78)">
          {props.children}
        </Text>
      </View>
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
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  tabBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECEFED',
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(45,106,79,0.28)',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 26,
    gap: 12,
  },
  stateWrap: {
    paddingTop: 24,
    paddingBottom: 12,
    alignItems: 'center',
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 23,
    lineHeight: 27,
    fontWeight: '800',
    color: '#1A1A2E',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  cardTitleShort: {
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '800',
    color: '#1A1A2E',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  valueWrap: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  cardValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  planList: {
    gap: 10,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  planDot: {
    marginTop: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(45,106,79,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planDotText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2D6A4F',
    fontFamily: 'Inter_700Bold',
  },
  footnote: {
    marginTop: 2,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  timelineWrap: {
    gap: 14,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  timelineRail: {
    width: 16,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C9D1CC',
    marginTop: 20,
  },
  timelineDotActive: {
    backgroundColor: '#2D6A4F',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginTop: 6,
    marginBottom: -8,
    borderRadius: 3,
    backgroundColor: '#DDE3DF',
  },
  visitCardPressable: {
    flex: 1,
  },
  visitCard: {
    borderRadius: 16,
    padding: 14,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
  },
  visitDate: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  visitName: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    marginTop: 2,
  },
  visitRole: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  badgeRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  serviceBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  summary: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(11,27,20,0.8)',
    fontFamily: 'Inter_500Medium',
  },
  pressed: {
    opacity: 0.88,
  },
});

function toReadable(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? text : 'Не указано.';
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Не указано.';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
