import FontAwesome from '@expo/vector-icons/FontAwesome'
import { FontAwesome5 } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  View as RNView,
  ScrollView,
  StyleSheet,
} from 'react-native'

import { Text, View } from '@/components/Themed'
import { refreshNextAppointmentRemote } from '@/features/appointment/next-appointment-session'
import { cancelAppointmentByClient } from '@/features/booking/booking-api'
import { useHomeScreenData } from '@/pages/home/model/useHomeScreenData'
import { CancelAppointmentSheet } from '@/pages/home/ui/CancelAppointmentSheet'
import { NextAppointmentCard } from './NextAppointmentCard'
import { ApiError } from '@/shared/api/api-error'
import { LeafLogo } from '@/shared/ui/icons/LeafLogo'
import { ConcernIcon } from '@/shared/ui/icons/concerns/ConcernIcon'
import { SafeAreaPadding } from '@/shared/ui/safe-area'

const FAQ_HOME_PREVIEW_COUNT = 3

export function HomePage() {
  const {
    loading,
    error,
    reload,
    firstName,
    faq,
    healthConcerns,
    studioDirections,
    appointmentPresentation,
    selectedStudioId,
    studioLabel,
  } = useHomeScreenData();

  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const appointmentId = appointmentPresentation?.appointmentId;

  const onCancelAppointmentPress = useCallback(() => {
    if (!appointmentId || cancelSubmitting) return;
    setCancelSheetOpen(true);
  }, [appointmentId, cancelSubmitting]);

  const handleConfirmCancelAppointment = useCallback(
    async (reason: string | undefined) => {
      if (!appointmentId) return;
      setCancelSubmitting(true);
      try {
        await cancelAppointmentByClient(
          appointmentId,
          reason != null && reason !== '' ? { reason } : {},
        );
        await refreshNextAppointmentRemote(selectedStudioId ?? undefined);
        setCancelSheetOpen(false);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Не удалось отменить запись';
        Alert.alert('Ошибка', msg);
      } finally {
        setCancelSubmitting(false);
      }
    },
    [appointmentId, selectedStudioId],
  );

  return (
    <View style={styles.root} lightColor="#F8F9FA" darkColor="#06130E">
      <SafeAreaPadding minTop={16} minBottom={0} style={styles.header} lightColor="#FFFFFF" darkColor="#06130E">
        <View style={styles.headerRow} lightColor="transparent" darkColor="transparent">
          <RNView style={styles.headerSide}>
            <LeafLogo size={70} color="#707973" />
          </RNView>

          <RNView pointerEvents="none" style={styles.headerCenter}>
            <Text style={styles.brand}>Solodova Recovery System</Text>
          </RNView>

          <Pressable
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityLabel="Уведомления"
            onPress={() => router.push('/(app)/notification-settings' as never)}
          >
            <FontAwesome name="bell-o" size={18} color="#2D6A4F" />
          </Pressable>
        </View>
      </SafeAreaPadding>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.bannerRow} lightColor="transparent" darkColor="transparent">
            <ActivityIndicator />
            <Text style={styles.bannerText} lightColor="rgba(11,27,20,0.55)" darkColor="rgba(255,255,255,0.55)">
              Загрузка…
            </Text>
          </View>
        ) : null}

        {error ? (
          <Pressable onPress={() => void reload()} style={({ pressed }) => [styles.errorBanner, pressed && styles.pressed]}>
            <Text style={styles.errorBannerText} lightColor="#93000A" darkColor="#FFB4A9">
              {error}. Нажмите, чтобы повторить.
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.hero} lightColor="transparent" darkColor="transparent">
          <Text style={styles.greeting}>
            Привет, {firstName.trim() ? firstName.trim() : 'друг'}{' '}
            <Text style={styles.wave} />
          </Text>
          <Text style={styles.heroSub} lightColor="rgba(11,27,20,0.65)" darkColor="rgba(255,255,255,0.65)">
            Добро пожаловать в ваше личное пространство{'\n'}заботы.
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/(app)/studio-selector' as any)}
          style={({ pressed }) => [styles.studioPill, pressed && styles.pressed]}
        >
          <FontAwesome name="map-marker" size={20} color="#2D6A4F" />
          <Text style={styles.studioText}>{studioLabel}</Text>
          <FontAwesome name="chevron-down" size={14} color="rgba(11,27,20,0.55)" />
        </Pressable>

        <View style={styles.section} lightColor="transparent" darkColor="transparent">
          <Text style={styles.sectionTitle}>Ближайшая запись</Text>
          <NextAppointmentCard
            appointment={appointmentPresentation}
            cancelSubmitting={cancelSubmitting}
            onCancelPress={onCancelAppointmentPress}
            onBookPress={() => router.push('/(app)/(tabs)/booking')}
          />
        </View>

        <View style={styles.section} lightColor="transparent" darkColor="transparent">
          <Text style={styles.sectionTitle}>Что вас беспокоит?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.concernsRow}
          >
            {healthConcerns.map((item) => (
              <Pressable
                key={item.id}
                onPress={() =>
                  router.push(`/(app)/health-concern/${item.slug}` as any)
                }
                style={({ pressed }) => [styles.concern, pressed && styles.pressed]}
              >
                <View style={styles.concernIcon}>
                  <ConcernIcon slug={item.slug} title={item.title} size={18} color="#2D6A4F" />
                </View>
                <Text style={styles.concernText} numberOfLines={2}>
                  {item.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section} lightColor="transparent" darkColor="transparent">
          <View style={styles.sectionRow} lightColor="transparent" darkColor="transparent">
            <Text style={styles.sectionTitle}>Направления студии</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.specCardsRow}>
            {studioDirections.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => router.push(`/(app)/studio-direction/${s.slug}` as any)}
                style={({ pressed }) => [styles.specCard, pressed && styles.pressed]}
              >
                <RNView style={styles.specIconWrap}>
                  <FontAwesome5 name={s.iconKey as never} size={22} color="#2D6A4F" />
                </RNView>
                <RNView style={styles.specCardBody}>
                  <RNView style={styles.specCardTextBlock}>
                    <Text style={styles.specCardName} numberOfLines={4}>
                      {s.title}
                    </Text>
                  </RNView>
                </RNView>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {faq.length > 0 ? (
          <View style={styles.section} lightColor="transparent" darkColor="transparent">
            <Text style={styles.sectionTitle}>Популярные вопросы</Text>
            <View style={styles.faqList} lightColor="transparent" darkColor="transparent">
              {faq.slice(0, FAQ_HOME_PREVIEW_COUNT).map((item) => {
                const open = expandedFaqId === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setExpandedFaqId((v) => (v === item.id ? null : item.id))}
                    style={({ pressed }) => [styles.faqItem, pressed && styles.pressed]}
                  >
                    <View style={styles.faqTop} lightColor="transparent" darkColor="transparent">
                      <Text style={styles.faqQ}>{item.question}</Text>
                      <FontAwesome name={open ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(112,121,115,1)" />
                    </View>
                    {open ? (
                      <Text style={styles.faqA} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
                        {item.answer}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <CancelAppointmentSheet
        visible={cancelSheetOpen}
        onClose={() => setCancelSheetOpen(false)}
        serviceName={appointmentPresentation?.serviceName ?? ''}
        dateLine={appointmentPresentation?.dateLine ?? ''}
        timeLine={appointmentPresentation?.timeLine ?? ''}
        submitting={cancelSubmitting}
        onConfirm={(reason) => {
          void handleConfirmCancelAppointment(reason);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1 
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(149,163,160,0.25)',
  },
  headerRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSide: { 
    width: 36, 
    height: 36, 
    alignItems: 'flex-start', 
    justifyContent: 'center' 
  },
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F5238',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 24,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  errorBanner: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(186,26,26,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(186,26,26,0.25)',
  },
  errorBannerText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  hero: { 
    gap: 8,
    paddingTop: 18 
  },
  greeting: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#1A1A2E',
    fontFamily: Platform.select({ ios: 'Liberation Serif', android: 'serif' }),
  },
  wave: { 
    fontSize: 30 
  },
  heroSub: { 
    fontSize: 16, 
    lineHeight: 22, 
    fontWeight: '600' 
  },
  studioPill: {
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F5',
    borderWidth: 1,
    borderColor: 'rgba(191,201,193,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  studioText: { 
    fontWeight: '800', 
    fontFamily: 'PlusJakartaSans_800ExtraBold' 
  },
  section: { 
    gap: 10, 
    paddingTop: 6 
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLink: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  sectionLinkText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontFamily: Platform.select({ ios: 'Liberation Serif', android: 'serif' }),
    color: '#1A1A2E',
  },
  concernsRow: {
    gap: 10,
    paddingRight: 8,
  },
  concern: {
    width: 100,
    height: 93,
    borderRadius: 16,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    alignItems: 'center',
    gap: 8,
  },
  concernIcon: { 
    width: 34, 
    height: 34, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(45,106,79,0.08)',
  },
  concernText: { 
    textAlign: 'center', 
    fontSize: 12, 
    fontWeight: '900' 
  },
  specCardsRow: {
    gap: 14,
    paddingRight: 8,
    alignItems: 'stretch',
  },
  specCard: {
    width: 190,
    height: 228,
    alignSelf: 'stretch',
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    alignItems: 'center',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { 
      width: 0, 
      height: 4 
    },
  },
  specCardBody: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  specCardTextBlock: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
  },
  specIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45,106,79,0.10)',
    marginBottom: 12,
  },
  specCardName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  faqList: {
    gap: 12,
  },
  faqItem: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { 
      width: 0, 
      height: 4 
    },
  },
  faqTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQ: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 20,
  },
  faqA: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  pressed: { 
    opacity: 0.85 
  },
});

