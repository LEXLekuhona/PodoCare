import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { fetchStudioSpecialists, type StudioSpecialistDto } from '@/features/booking/booking-api';
import { loadSelectedStudio } from '@/features/studio/local-studio-storage';
import { ApiError } from '@/shared/api/api-error';
import { sanitizeRouteParam } from '@/shared/navigation/route-params';
import { AppHeader } from '@/shared/ui/AppHeader';
import { getAppBranding } from '@/shared/config/branding';

const BRAND_GREEN = '#0F5238';
const PRIMARY = '#2D6A4F';
const SURFACE_SEARCH = '#F3F4F5';
const ON_SURFACE = '#191C1D';
const ON_SURFACE_MUTED = '#5C6360';
const OUTLINE_CHIP = 'rgba(112, 121, 115, 0.35)';

const ALL_FILTER_ID = 'all';

type FilterOption = {
  id: string;
  label: string;
};

type SpecialistRow = StudioSpecialistDto & {
  name: string;
  filterKey: string;
};

function titleToFilterKey(title: string): string {
  const normalizedTitle = normalize(title);
  return normalizedTitle !== '' ? `title:${normalizedTitle}` : 'title:unknown';
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

type ListHeaderProps = {
  caption?: string;
  query: string;
  onQueryChange: Dispatch<SetStateAction<string>>;
  filter: string;
  filters: FilterOption[];
  onFilterChange: (id: string) => void;
};

function SpecialistListHeader(props: ListHeaderProps) {
  const colorScheme = useColorScheme();
  const inputColor = colorScheme === 'dark' ? '#F5FBF7' : ON_SURFACE;

  return (
    <View style={styles.headerBlock} lightColor="transparent" darkColor="transparent">
      <Text style={styles.heroTitle} lightColor={ON_SURFACE} darkColor="#F5FBF7">
        Найдите своего специалиста
      </Text>
      {props.caption ? (
        <Text style={styles.heroCaption} lightColor={ON_SURFACE_MUTED} darkColor="rgba(255,255,255,0.55)">
          {props.caption}
        </Text>
      ) : null}

      <View style={styles.searchWrap} lightColor={SURFACE_SEARCH} darkColor="rgba(255,255,255,0.08)">
        <FontAwesome name="search" size={16} color={ON_SURFACE_MUTED} style={styles.searchIcon} />
        <TextInput
          placeholder="Имя, специальность или услуга"
          placeholderTextColor="rgba(92, 99, 96, 0.75)"
          value={props.query}
          onChangeText={props.onQueryChange}
          style={[styles.searchInput, { color: inputColor }]}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {props.filters.map((f) => {
          const active = props.filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => props.onFilterChange(f.id)}
              style={({ pressed }) => [
                styles.chip,
                active ? styles.chipActive : styles.chipInactive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.chipLabel, active && styles.chipLabelActive]}
                lightColor={active ? '#FFFFFF' : ON_SURFACE}
                darkColor={active ? '#FFFFFF' : '#E8EFEA'}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function SpecialistsPage() {
  const insets = useSafeAreaInsets();
  const canGoBack = router.canGoBack();

  const serviceFilterId = sanitizeRouteParam(useLocalSearchParams().serviceId);
  const serviceFilterName = sanitizeRouteParam(useLocalSearchParams().serviceName);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>(ALL_FILTER_ID);
  const [specialists, setSpecialists] = useState<SpecialistRow[]>([]);
  const [studioLocation, setStudioLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const studio = await loadSelectedStudio();
      if (!studio?.id) {
        setSpecialists([]);
        setStudioLocation('');
        setListError('Сначала выберите студию на главном экране');
        return;
      }
      setStudioLocation(`${studio.name}, ${studio.address}`);
      const rows = await fetchStudioSpecialists(studio.id, {
        serviceId: serviceFilterId,
      });
      setSpecialists(
        rows.map((r) => ({
          ...r,
          name: `${r.firstName} ${r.lastName}`.trim(),
          filterKey: titleToFilterKey(r.title),
        })),
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Не удалось загрузить специалистов';
      setListError(msg);
      setSpecialists([]);
    } finally {
      setLoading(false);
    }
  }, [serviceFilterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filterOptions = useMemo<FilterOption[]>(() => {
    const byKey = new Map<string, string>();
    for (const specialist of specialists) {
      const label = specialist.title.trim();
      if (label === '' || byKey.has(specialist.filterKey)) continue;
      byKey.set(specialist.filterKey, label);
    }
    const dynamicFilters = [...byKey.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    return [{ id: ALL_FILTER_ID, label: 'Все' }, ...dynamicFilters];
  }, [specialists]);

  useEffect(() => {
    if (filterOptions.some((option) => option.id === filter)) return;
    setFilter(ALL_FILTER_ID);
  }, [filter, filterOptions]);

  const heroCaption = serviceFilterId
    ? 'Показаны только те мастера, кто оказывает выбранную услугу. Дальше — время приёма.'
    : 'Дальше выберите услугу у мастера и удобное время.';

  const filtered = useMemo(() => {
    const q = normalize(query);
    return specialists
      .filter((s) => {
        if (filter !== ALL_FILTER_ID && s.filterKey !== filter) return false;
        if (!q) return true;
        const hay = `${s.name} ${s.title} ${studioLocation}`;
        return normalize(hay).includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [query, filter, specialists, studioLocation]);

  const listBottomPad = 24 + Math.max(insets.bottom, 12);

  return (
    <View style={styles.root} lightColor="#FFFFFF" darkColor="#06130E">
      <AppHeader
        title={getAppBranding().brandName}
        titleStyle={styles.headerBrand}
        onBackPress={canGoBack ? () => router.back() : undefined}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            {serviceFilterId ? (
              <View style={styles.serviceFilterBanner} lightColor="rgba(45,106,79,0.10)" darkColor="rgba(149,212,179,0.14)">
                <Text style={styles.serviceFilterText} lightColor={ON_SURFACE} darkColor="#F5FBF7">
                  Услуга:{' '}
                  <Text style={styles.serviceFilterStrong}>{serviceFilterName ?? 'выбранная в каталоге'}</Text>
                </Text>
                <Pressable
                  onPress={() => router.replace('/(app)/specialists')}
                  style={({ pressed }) => [styles.serviceFilterClear, pressed && styles.pressed]}
                >
                  <Text style={styles.serviceFilterClearLabel} lightColor={PRIMARY} darkColor="#95D4B3">
                    Все специалисты
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <SpecialistListHeader
              caption={heroCaption}
              query={query}
              onQueryChange={setQuery}
              filter={filter}
              filters={filterOptions}
              onFilterChange={setFilter}
            />
            {loading ? (
              <View style={styles.loader} lightColor="transparent" darkColor="transparent">
                <ActivityIndicator />
              </View>
            ) : listError ? (
              <View style={styles.bannerErr} lightColor="transparent" darkColor="transparent">
                <Text style={styles.emptyText} lightColor={ON_SURFACE_MUTED} darkColor="rgba(255,255,255,0.5)">
                  {listError}
                </Text>
                <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryMini, pressed && styles.pressed]}>
                  <Text style={styles.retryMiniLabel}>Обновить</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad }]}
        ItemSeparatorComponent={() => <RNView style={styles.separator} />}
        ListEmptyComponent={
          !loading && !listError ? (
            <View style={styles.empty} lightColor="transparent" darkColor="transparent">
              <Text style={styles.emptyText} lightColor={ON_SURFACE_MUTED} darkColor="rgba(255,255,255,0.5)">
                {serviceFilterId
                  ? 'У этой услуги пока нет доступных специалистов в студии. Попробуйте другую услугу или посмотрите всех мастеров.'
                  : 'Нет специалистов по заданным условиям'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              router.push({
                pathname: '/(app)/service-selection',
                params: {
                  specialistId: item.id,
                  specialistName: item.name,
                  specialistTitle: item.title,
                  ...(serviceFilterId ? { prefillServiceId: serviceFilterId } : {}),
                },
              });
            }}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <View style={styles.card} lightColor="#FFFFFF" darkColor="#0F1F19">
              <RNView style={styles.avatar} accessibilityLabel="">
                <Text style={styles.avatarText} lightColor={PRIMARY} darkColor="#95D4B3">
                  {initialsFromName(item.name)}
                </Text>
              </RNView>
              <View style={styles.cardBody} lightColor="transparent" darkColor="transparent">
                <Text style={styles.name} lightColor={ON_SURFACE} darkColor="#F5FBF7">
                  {item.name}
                </Text>
                <Text style={styles.specialty} lightColor={PRIMARY} darkColor="#95D4B3">
                  {item.title}
                </Text>
                <RNView style={styles.locationRow}>
                  <FontAwesome name="map-marker" size={12} color={ON_SURFACE_MUTED} />
                  <Text style={styles.location} lightColor={ON_SURFACE_MUTED} darkColor="rgba(255,255,255,0.55)">
                    {studioLocation || 'Студия'}
                  </Text>
                </RNView>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBrand: {
    color: BRAND_GREEN,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
    paddingBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    fontFamily: Platform.select({ ios: 'Liberation Serif', android: 'serif' }),
  },
  heroCaption: {
    marginTop: -6,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
  },
  serviceFilterBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 10,
  },
  serviceFilterText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    lineHeight: 20,
  },
  serviceFilterStrong: {
    fontFamily: 'Inter_700Bold',
  },
  serviceFilterClear: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  serviceFilterClearLabel: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    minHeight: 48,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    paddingVertical: 0,
  },
  chipsRow: {
    gap: 8,
    paddingRight: 16,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  chipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: OUTLINE_CHIP,
  },
  chipLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  chipLabelActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingTop: 4,
    flexGrow: 1,
  },
  separator: { height: 10 },
  empty: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  card: {
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149, 163, 160, 0.28)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 9999,
    backgroundColor: 'rgba(45, 106, 79, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  specialty: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  location: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  pressed: { opacity: 0.92 },
  loader: { paddingVertical: 24, alignItems: 'center' },
  bannerErr: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
  retryMini: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12 },
  retryMiniLabel: { color: PRIMARY, fontFamily: 'Inter_700Bold', fontSize: 14 },
});
