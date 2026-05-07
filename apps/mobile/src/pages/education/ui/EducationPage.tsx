import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import {
  type EducationAudience,
  type FeaturedDto,
  type FreeMaterialDto,
  type FreeMaterialKind,
  type MyCourseDto,
  type ContentFeedItemDto,
  clickContentItemCta,
  fetchEducationScreen,
  fetchClientContentFeed,
  saveContentItemProgress,
} from '@/features/education/education-api';
import { resolveContentCtaNavigation } from '@/features/education/content-cta-routing';
import { ApiError } from '@/shared/api/api-error';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

const PRIMARY = '#0F5238';
const PRIMARY_CONTAINER = '#2D6A4F';
const SECONDARY = '#006C48';
const ON_SURFACE = '#191C1D';
const ON_SURFACE_VARIANT = '#404943';
const ON_CARD_TITLE = '#1A1A2E';
const SURFACE = '#F8F9FA';
const SURFACE_LOW = '#F3F4F5';
const OUTLINE = '#707973';
const TRACK = '#E7E8E9';

function formatRub(n: number): string {
  return `${n.toLocaleString('ru-RU')} ₽`;
}

function materialIcon(kind: FreeMaterialKind): React.ComponentProps<typeof FontAwesome>['name'] {
  if (kind === 'video') return 'play-circle-o';
  if (kind === 'article') return 'file-text-o';
  return 'file-pdf-o';
}

function materialKindLabel(kind: FreeMaterialKind): string {
  if (kind === 'video') return 'Видео';
  if (kind === 'article') return 'Статья';
  return 'PDF';
}

function featuredFormatLabel(format: FeaturedDto['format']): string {
  return format === 'webinar' ? 'Вебинар' : 'Интенсив';
}

function CoverImage(props: { uri: string | null | undefined; style: object; accessibilityLabel: string }) {
  const [failed, setFailed] = useState(false);
  if (!props.uri || failed) {
    return (
      <RNView style={[props.style as object, styles.coverFallback]} accessibilityLabel={props.accessibilityLabel}>
        <FontAwesome name="image" size={28} color={OUTLINE} />
      </RNView>
    );
  }
  return (
    <Image
      source={{ uri: props.uri }}
      style={props.style}
      resizeMode="cover"
      accessibilityLabel={props.accessibilityLabel}
      onError={() => setFailed(true)}
    />
  );
}

function comingSoon(action: string) {
  Alert.alert('Скоро', `${action} появится в следующем обновлении.`);
}

export function EducationPage() {
  const insets = useSafeAreaInsets();
  const [audience, setAudience] = useState<EducationAudience>('client');
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchEducationScreen>> | null>(null);
  const [clientFeed, setClientFeed] = useState<ContentFeedItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (audience === 'client') {
        const [screen, feed] = await Promise.all([fetchEducationScreen(audience), fetchClientContentFeed()]);
        setData(screen);
        setClientFeed(feed.items);
      } else {
        const res = await fetchEducationScreen(audience);
        setData(res);
        setClientFeed([]);
      }
    } catch (e: unknown) {
      const message = e instanceof ApiError ? e.message : 'Не удалось загрузить раздел';
      setError(message);
      setData(null);
      setClientFeed([]);
    } finally {
      setLoading(false);
    }
  }, [audience]);

  const handleProgress = useCallback(
    async (item: ContentFeedItemDto, percent: number) => {
      setBusyItemId(item.id);
      try {
        await saveContentItemProgress(item.id, { percent });
        await load();
      } catch (e: unknown) {
        const message = e instanceof ApiError ? e.message : 'Не удалось сохранить прогресс';
        Alert.alert('Ошибка', message);
      } finally {
        setBusyItemId(null);
      }
    },
    [load],
  );

  const handleCta = useCallback(async (item: ContentFeedItemDto) => {
    const cta = item.ctas[0];
    if (!cta) return;
    setBusyItemId(item.id);
    try {
      await clickContentItemCta(item.id, cta.id);
      const nav = resolveContentCtaNavigation(cta);
      if (nav.kind === 'external') {
        await Linking.openURL(nav.url);
        return;
      }
      if (nav.kind === 'expo-router') {
        router.push({ pathname: nav.pathname, params: nav.params } as never);
        return;
      }
      comingSoon(cta.label);
    } catch (e: unknown) {
      const message = e instanceof ApiError ? e.message : 'Не удалось выполнить CTA';
      Alert.alert('Ошибка', message);
    } finally {
      setBusyItemId(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const scrollBottomPad = 24 + Math.max(insets.bottom, 12);

  return (
    <View style={styles.root} lightColor={SURFACE} darkColor="#06130E">
      <SafeAreaPadding minTop={12} minBottom={0} style={styles.headerWrap} lightColor="#FFFFFF" darkColor="#06130E">
        <RNView style={styles.headerRow}>
          <Pressable
            style={styles.headerLeft}
            onPress={() => router.push('/profile')}
            accessibilityLabel="Профиль"
          >
            <RNView style={styles.avatar}>
              <FontAwesome name="user" size={20} color={OUTLINE} />
            </RNView>
            <Text style={styles.headerTitle} lightColor={PRIMARY} darkColor="#95D4B3">
              Обучение
            </Text>
          </Pressable>
          <Pressable
            style={styles.bellBtn}
            onPress={() => router.push('/(app)/notification-settings' as never)}
            accessibilityLabel="Уведомления"
          >
            <FontAwesome name="bell-o" size={20} color={PRIMARY_CONTAINER} />
          </Pressable>
        </RNView>
      </SafeAreaPadding>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
      >
        {loading && !data ? (
          <RNView style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.55)">
              Загрузка…
            </Text>
          </RNView>
        ) : null}

        {error ? (
          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.errorBanner, pressed && styles.pressed]}>
            <Text style={styles.errorBannerText} lightColor="#93000A" darkColor="#FFB4A9">
              {error}. Нажмите, чтобы повторить.
            </Text>
          </Pressable>
        ) : null}

        <RNView style={styles.segmentWrap}>
          <View style={styles.segmentRail} lightColor={SURFACE_LOW} darkColor="rgba(255,255,255,0.08)">
            <Pressable
              onPress={() => setAudience('client')}
              style={({ pressed }) => [
                styles.segmentBtn,
                audience === 'client' && styles.segmentBtnActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.segmentLabel, audience === 'client' && styles.segmentLabelActive]}
                lightColor={audience === 'client' ? PRIMARY : ON_SURFACE_VARIANT}
                darkColor={audience === 'client' ? '#95D4B3' : 'rgba(255,255,255,0.55)'}
              >
                Для клиентов
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAudience('master')}
              style={({ pressed }) => [
                styles.segmentBtn,
                audience === 'master' && styles.segmentBtnActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.segmentLabel, audience === 'master' && styles.segmentLabelActive]}
                lightColor={audience === 'master' ? PRIMARY : ON_SURFACE_VARIANT}
                darkColor={audience === 'master' ? '#95D4B3' : 'rgba(255,255,255,0.55)'}
              >
                Для мастеров
              </Text>
            </Pressable>
          </View>
        </RNView>

        {data ? (
          <>
            {audience === 'client' ? (
              <Section title="Лента контента">
                {clientFeed.length === 0 ? (
                  <Text style={styles.emptyHint} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.5)">
                    Пока нет опубликованных материалов.
                  </Text>
                ) : (
                  clientFeed.map((item) => (
                    <ClientContentCard
                      key={item.id}
                      item={item}
                      busy={busyItemId === item.id}
                      onProgress={handleProgress}
                      onCta={handleCta}
                    />
                  ))
                )}
              </Section>
            ) : null}
            <Section title="Мои курсы">
              {data.myCourses.length === 0 ? (
                <Text style={styles.emptyHint} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.5)">
                  Пока нет курсов в прогрессе — загляните в каталог материалов.
                </Text>
              ) : (
                data.myCourses.map((course) => <CourseCard key={course.id} course={course} />)
              )}
            </Section>

            <Section
              title="Бесплатные материалы"
              right={
                <Pressable onPress={() => comingSoon('Каталог материалов')} hitSlop={8} style={styles.allLink}>
                  <Text style={styles.allLinkText} lightColor={PRIMARY_CONTAINER} darkColor="#95D4B3">
                    Все
                  </Text>
                  <FontAwesome name="arrow-right" size={14} color={PRIMARY_CONTAINER} style={styles.allLinkIcon} />
                </Pressable>
              }
            >
              <FlatList
                horizontal
                data={data.freeMaterials}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hListContent}
                ItemSeparatorComponent={() => <RNView style={{ width: 16 }} />}
                renderItem={({ item }) => <FreeMaterialCard item={item} />}
                ListEmptyComponent={
                  <Text style={styles.emptyHint} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.5)">
                    Материалы скоро появятся.
                  </Text>
                }
              />
            </Section>

            <Section title="Полезное">
              {data.featured.length === 0 ? (
                <Text style={styles.emptyHint} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.5)">
                  Пока нет предложений.
                </Text>
              ) : (
                data.featured.map((item) => <FeaturedCard key={item.id} item={item} />)
              )}
            </Section>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Section(props: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <RNView style={styles.section}>
      <RNView style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle} lightColor={ON_SURFACE} darkColor="#FFFFFF">
          {props.title}
        </Text>
        {props.right}
      </RNView>
      {props.children}
    </RNView>
  );
}

function CourseCard({ course }: { course: MyCourseDto }) {
  const p = Math.min(100, Math.max(0, course.progressPercent));
  return (
    <View style={styles.courseCard} lightColor="#FFFFFF" darkColor="#0C1A14">
      <CoverImage uri={course.coverUrl} style={styles.courseCover} accessibilityLabel={course.title} />
      <RNView style={styles.courseBody}>
        <RNView style={styles.courseTop}>
          <RNView style={styles.badgeCourse}>
            <Text style={styles.badgeCourseText} lightColor={PRIMARY} darkColor="#95D4B3">
              Курс
            </Text>
          </RNView>
          <Text style={styles.courseTitle} lightColor={ON_CARD_TITLE} darkColor="#FFFFFF" numberOfLines={1}>
            {course.title}
          </Text>
        </RNView>
        <RNView style={styles.progressBlock}>
          <RNView style={styles.progressLabels}>
            <Text style={styles.progressMeta} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.6)">
              Прогресс: {p}%
            </Text>
            <Text style={styles.progressMeta} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.6)">
              {course.completedLessons} / {course.totalLessons} уроков
            </Text>
          </RNView>
          <RNView style={styles.track}>
            <LinearGradient
              colors={[PRIMARY, PRIMARY_CONTAINER]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.trackFill, { width: `${p}%` }]}
            />
          </RNView>
        </RNView>
      </RNView>
    </View>
  );
}

function FreeMaterialCard({ item }: { item: FreeMaterialDto }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.freeCard, pressed && styles.pressed]}
      onPress={() => comingSoon(item.title)}
    >
      <View style={styles.freeCardInner} lightColor="#FFFFFF" darkColor="#0C1A14">
        <RNView style={styles.freeCoverWrap}>
          <CoverImage uri={item.coverUrl ?? undefined} style={styles.freeCover} accessibilityLabel={item.title} />
          <RNView style={styles.kindPill}>
            <FontAwesome name={materialIcon(item.kind)} size={14} color={PRIMARY} />
            <Text style={styles.kindPillText} lightColor={ON_CARD_TITLE} darkColor="#FFFFFF">
              {materialKindLabel(item.kind)}
            </Text>
          </RNView>
        </RNView>
        <RNView style={styles.freeCardText}>
          <Text style={styles.freeTitle} lightColor={ON_CARD_TITLE} darkColor="#FFFFFF" numberOfLines={2}>
            {item.title}
          </Text>
          <RNView style={styles.freeMetaRow}>
            <FontAwesome name={item.kind === 'pdf' ? 'download' : 'clock-o'} size={14} color={OUTLINE} />
            <Text style={styles.freeMeta} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.55)">
              {item.metaLabel}
            </Text>
          </RNView>
        </RNView>
      </View>
    </Pressable>
  );
}

function FeaturedCard({ item }: { item: FeaturedDto }) {
  const cta =
    item.cta === 'register' ? 'Записаться' : 'Подробнее';
  const onCta = () => comingSoon(cta);

  return (
    <View style={styles.featuredCard} lightColor="#FFFFFF" darkColor="#0C1A14">
      <RNView style={styles.featuredCoverWrap}>
        <CoverImage uri={item.coverUrl ?? undefined} style={styles.featuredCover} accessibilityLabel={item.title} />
        <RNView style={[styles.kindPill, styles.kindPillFeaturedLeft]}>
          <FontAwesome
            name={item.format === 'webinar' ? 'microphone' : 'graduation-cap'}
            size={14}
            color={SECONDARY}
          />
          <Text style={styles.kindPillText} lightColor={ON_CARD_TITLE} darkColor="#FFFFFF">
            {featuredFormatLabel(item.format)}
          </Text>
        </RNView>
        <RNView style={styles.pricePill}>
          <Text style={styles.pricePillText} lightColor={ON_CARD_TITLE} darkColor="#FFFFFF">
            {formatRub(item.priceRub)}
          </Text>
        </RNView>
      </RNView>
      <RNView style={styles.featuredBody}>
        <Text style={styles.featuredTitle} lightColor={ON_CARD_TITLE} darkColor="#FFFFFF" numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.featuredDesc} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.6)" numberOfLines={2}>
          {item.description}
        </Text>
        <RNView style={styles.featuredMetaRow}>
          <RNView style={styles.featuredMetaItem}>
            <FontAwesome name={item.format === 'webinar' ? 'calendar' : 'list'} size={16} color={OUTLINE} />
            <Text style={styles.featuredMetaText} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.55)">
              {item.metaLeft}
            </Text>
          </RNView>
          <RNView style={styles.featuredMetaItem}>
            <FontAwesome name={item.format === 'webinar' ? 'clock-o' : 'refresh'} size={16} color={OUTLINE} />
            <Text style={styles.featuredMetaText} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.55)">
              {item.metaRight}
            </Text>
          </RNView>
        </RNView>
        <Pressable onPress={onCta} style={({ pressed }) => [styles.ctaOuter, pressed && styles.pressed]}>
          <LinearGradient
            colors={[PRIMARY, PRIMARY_CONTAINER]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>{cta}</Text>
          </LinearGradient>
        </Pressable>
      </RNView>
    </View>
  );
}

function ClientContentCard(props: {
  item: ContentFeedItemDto;
  busy: boolean;
  onProgress: (item: ContentFeedItemDto, percent: number) => void;
  onCta: (item: ContentFeedItemDto) => void;
}) {
  const percent = Math.min(100, Math.max(0, props.item.progress.percent));
  const cta = props.item.ctas[0];
  const locked = props.item.paywall.isLocked;

  return (
    <View style={styles.courseCard} lightColor="#FFFFFF" darkColor="#0C1A14">
      <CoverImage uri={props.item.coverImageUrl} style={styles.courseCover} accessibilityLabel={props.item.title} />
      <RNView style={styles.courseBody}>
        <RNView style={styles.courseTop}>
          <RNView style={styles.badgeCourse}>
            <Text style={styles.badgeCourseText} lightColor={PRIMARY} darkColor="#95D4B3">
              {props.item.format}
            </Text>
          </RNView>
          <Text style={styles.courseTitle} lightColor={ON_CARD_TITLE} darkColor="#FFFFFF" numberOfLines={2}>
            {props.item.title}
          </Text>
        </RNView>

        <RNView style={styles.progressBlock}>
          <RNView style={styles.progressLabels}>
            <Text style={styles.progressMeta} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.6)">
              Прогресс: {percent}%
            </Text>
            <Text style={styles.progressMeta} lightColor={ON_SURFACE_VARIANT} darkColor="rgba(255,255,255,0.6)">
              {locked ? 'Доступ закрыт' : props.item.paywall.mode}
            </Text>
          </RNView>
          <RNView style={styles.track}>
            <LinearGradient
              colors={[PRIMARY, PRIMARY_CONTAINER]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.trackFill, { width: `${percent}%` }]}
            />
          </RNView>
        </RNView>

        {!locked ? (
          <RNView style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Pressable
              onPress={() => props.onProgress(props.item, Math.max(percent, 50))}
              style={({ pressed }) => [styles.segmentBtn, { flex: 1 }, pressed && styles.pressed]}
              disabled={props.busy}
            >
              <Text style={styles.segmentLabel} lightColor={PRIMARY} darkColor="#95D4B3">
                50%
              </Text>
            </Pressable>
            <Pressable
              onPress={() => props.onProgress(props.item, 100)}
              style={({ pressed }) => [styles.segmentBtn, { flex: 1 }, pressed && styles.pressed]}
              disabled={props.busy}
            >
              <Text style={styles.segmentLabel} lightColor={PRIMARY} darkColor="#95D4B3">
                Завершить
              </Text>
            </Pressable>
          </RNView>
        ) : null}

        {cta && !locked ? (
          <Pressable onPress={() => props.onCta(props.item)} style={({ pressed }) => [styles.ctaOuter, pressed && styles.pressed]}>
            <LinearGradient
              colors={[PRIMARY, PRIMARY_CONTAINER]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>{cta.label}</Text>
            </LinearGradient>
          </Pressable>
        ) : null}
      </RNView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerWrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(149,163,160,0.25)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SURFACE_LOW,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SURFACE_LOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 0,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  errorBanner: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: 'rgba(186,26,26,0.08)',
  },
  errorBannerText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    lineHeight: 20,
  },
  segmentWrap: {
    marginBottom: 28,
    maxWidth: 420,
    alignSelf: 'stretch',
  },
  segmentRail: {
    flexDirection: 'row',
    padding: 6,
    borderRadius: 14,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1A2E',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  segmentLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  segmentLabelActive: {
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  section: {
    marginBottom: 36,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: '600',
    letterSpacing: -0.5,
    flex: 1,
  },
  allLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allLinkText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  allLinkIcon: {
    marginLeft: 4,
    marginTop: 1,
  },
  courseCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.2)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1A2E',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  courseCover: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: TRACK,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TRACK,
  },
  courseBody: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  courseTop: {
    gap: 6,
  },
  badgeCourse: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(177,240,206,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeCourseText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  courseTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: '600',
  },
  progressBlock: {
    gap: 6,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressMeta: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: TRACK,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 999,
  },
  hListContent: {
    paddingRight: 4,
    paddingBottom: 4,
  },
  freeCard: {
    width: 256,
  },
  freeCardInner: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.2)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1A2E',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  freeCoverWrap: {
    height: 140,
    backgroundColor: TRACK,
    position: 'relative',
  },
  freeCover: {
    width: '100%',
    height: '100%',
  },
  kindPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  kindPillFeaturedLeft: {
    top: 12,
    left: 12,
  },
  kindPillText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  freeCardText: {
    padding: 16,
    gap: 8,
    minHeight: 100,
  },
  freeTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontWeight: '600',
    lineHeight: 22,
  },
  freeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 'auto',
  },
  freeMeta: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  featuredCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.2)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A1A2E',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  featuredCoverWrap: {
    height: 192,
    backgroundColor: TRACK,
    position: 'relative',
  },
  featuredCover: {
    width: '100%',
    height: '100%',
  },
  pricePill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: SURFACE_LOW,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pricePillText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  featuredBody: {
    padding: 18,
    gap: 12,
  },
  featuredTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontWeight: '700',
    lineHeight: 24,
  },
  featuredDesc: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  featuredMetaRow: {
    flexDirection: 'row',
    gap: 20,
    flexWrap: 'wrap',
  },
  featuredMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featuredMetaText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  ctaOuter: {
    marginTop: 4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  ctaGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  pressed: { opacity: 0.92 },
});
