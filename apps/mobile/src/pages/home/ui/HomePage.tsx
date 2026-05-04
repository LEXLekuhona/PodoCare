import FontAwesome from '@expo/vector-icons/FontAwesome'
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
import { ApiError } from '@/shared/api/api-error'
import { LeafLogo } from '@/shared/ui/icons/LeafLogo'
import { FungusIcon } from '@/shared/ui/icons/concerns/FungusIcon'
import { NailIcon } from '@/shared/ui/icons/concerns/NailIcon'
import { SweatIcon } from '@/shared/ui/icons/concerns/SweatIcon'
import { SafeAreaPadding } from '@/shared/ui/safe-area'

export function HomePage() {
  const {
    loading,
    error,
    reload,
    firstName,
    faq,
    feedItems,
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
            <Text style={styles.brand}>PodoCare</Text>
          </RNView>

          <Pressable hitSlop={12} style={styles.iconBtn} onPress={() => {}}>
            <FontAwesome name="bell-o" size={18} color="#2D6A4F" />
            <RNView style={styles.bellDot} />
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
          {appointmentPresentation ? (
            <View style={styles.appointmentCard} lightColor="#FFFFFF" darkColor="#0C1A14">
              <RNView style={styles.appointmentAccent} />
              <View style={styles.appointmentTop} lightColor="transparent" darkColor="transparent">
                <Text style={styles.appointmentTitleMini} lightColor="#1A1A2E" darkColor="#F5FBF7">
                  Запись запланирована
                </Text>
                <View style={styles.whenDateRow} lightColor="transparent" darkColor="transparent">
                  <Text style={styles.whenDate} lightColor="#0F5238" darkColor="#0F5238">
                    {appointmentPresentation.dateLine}
                  </Text>
                  <View style={styles.statusPill} lightColor="rgba(149,163,160,0.16)" darkColor="rgba(255,255,255,0.10)">
                    <Text style={styles.statusText} lightColor="rgba(11,27,20,0.65)" darkColor="rgba(255,255,255,0.65)">
                      {appointmentPresentation.statusLabel}
                    </Text>
                  </View>
                </View>
                <Text style={styles.whenTime} lightColor="#1A1A2E" darkColor="#F5FBF7">
                  {appointmentPresentation.timeLine}
                </Text>
              </View>

              <View style={styles.divider} lightColor="rgba(149,163,160,0.25)" darkColor="rgba(255,255,255,0.10)" />

              <View style={styles.appointmentBottom} lightColor="transparent" darkColor="transparent">
                <View style={styles.specAvatar} lightColor="rgba(45,106,79,0.10)" darkColor="rgba(149,212,179,0.14)" />
                <View style={styles.specInfo} lightColor="transparent" darkColor="transparent">
                  <Text style={styles.specName} lightColor="#1A1A2E" darkColor="#F5FBF7">
                    {appointmentPresentation.specialistName}
                  </Text>
                  <Text style={styles.specService} lightColor="rgba(11,27,20,0.55)" darkColor="rgba(255,255,255,0.55)">
                    {appointmentPresentation.serviceName}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} lightColor="rgba(149,163,160,0.25)" darkColor="rgba(255,255,255,0.10)" />

              <View style={styles.appointmentAddrRow} lightColor="transparent" darkColor="transparent">
                <FontAwesome name="map-marker" size={14} color="rgba(11,27,20,0.55)" />
                <Text style={styles.address} lightColor="#404943" darkColor="#404943">
                  {appointmentPresentation.address}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Отменить запись"
                  disabled={cancelSubmitting}
                  onPress={onCancelAppointmentPress}
                  style={({ pressed }) => [
                    styles.cancelBtn,
                    pressed && !cancelSubmitting && styles.pressed,
                    cancelSubmitting && styles.cancelBtnDisabled,
                  ]}
                >
                  <Text style={styles.cancelText} lightColor="#BA1A1A" darkColor="#BA1A1A">
                    Отменить
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.emptyAppointment} lightColor="#FFFFFF" darkColor="#0C1A14">
              <Text style={styles.emptyAppointmentTitle} lightColor="#1A1A2E" darkColor="#FFFFFF">
                Нет предстоящих записей
              </Text>
              <Text style={styles.emptyAppointmentSub} lightColor="rgba(11,27,20,0.55)" darkColor="rgba(255,255,255,0.55)">
                Выберите студию, затем специалиста, услугу и удобное время — или начните с каталога услуг.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Записаться"
                onPress={() => router.push('/(app)/(tabs)/booking')}
                style={({ pressed }) => [styles.bookAppointmentBtn, pressed && styles.pressed]}
              >
                <Text style={styles.bookAppointmentBtnText} lightColor="#FFFFFF" darkColor="#FFFFFF">
                  Записаться
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.section} lightColor="transparent" darkColor="transparent">
          <Text style={styles.sectionTitle}>Что вас беспокоит?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.concernsRow}
          >
            {[
              { t: 'Грибок', renderIcon: () => <FungusIcon size={18} /> },
              { t: 'Вросший\nноготь', renderIcon: () => <NailIcon size={18} /> },
              { t: 'Потливость', renderIcon: () => <SweatIcon size={18} /> },
              { t: 'Пустота\nпод ногтем', renderIcon: () => <FontAwesome name="square-o" size={16} color="#2D6A4F" /> },
              { t: 'Мозоли', renderIcon: () => <FontAwesome name="circle-o" size={16} color="#2D6A4F" /> },
              { t: 'Трещины', renderIcon: () => <FontAwesome name="ellipsis-h" size={16} color="#2D6A4F" /> },
            ].map((item) => (
              <Pressable
                key={item.t}
                onPress={() => router.push('/(app)/(tabs)/booking')}
                style={({ pressed }) => [styles.concern, pressed && styles.pressed]}
              >
                <View style={styles.concernIcon}>
                  {item.renderIcon()}
                </View>
                <Text style={styles.concernText}>{item.t}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section} lightColor="transparent" darkColor="transparent">
          <View style={styles.sectionRow} lightColor="transparent" darkColor="transparent">
            <Text style={styles.sectionTitle}>Направления студии</Text>
            <Pressable onPress={() => router.push('/(app)/service-selection')} style={({ pressed }) => [styles.sectionLink, pressed && styles.pressed]}>
              <Text style={styles.sectionLinkText} lightColor="#2D6A4F" darkColor="#95D4B3">
                Все услуги
              </Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.specCardsRow}>
            {[
              {
                title: 'Медицинский педикюр',
                desc: 'Уход, обработка, профилактика',
                price: 'от 2 500 ₽',
                icon: 'leaf' as const,
              },
              {
                title: 'Лечение ногтей',
                desc: 'Грибок, вросший ноготь',
                price: 'от 3 000 ₽',
                icon: 'medkit' as const,
              },
              {
                title: 'Ортониксия',
                desc: 'Коррекция, сопровождение',
                price: 'от 3 500 ₽',
                icon: 'support' as const,
              },
            ].map((s) => (
              <Pressable
                key={s.title}
                onPress={() => router.push('/(app)/service-selection')}
                style={({ pressed }) => [styles.specCard, pressed && styles.pressed]}
              >
                <RNView style={styles.specIconWrap}>
                  <FontAwesome name={s.icon} size={22} color="#2D6A4F" />
                </RNView>
                <RNView style={styles.specCardBody}>
                  <RNView style={styles.specCardTextBlock}>
                    <Text style={styles.specCardName}>{s.title}</Text>
                    <Text style={styles.specCardRole} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
                      {s.desc}
                    </Text>
                  </RNView>
                  <RNView style={styles.specCardFooter}>
                    <View style={styles.specCardDivider} lightColor="rgba(191,201,193,0.35)" darkColor="rgba(255,255,255,0.10)" />
                    <Text style={styles.specCardPrice} lightColor="#2D6A4F" darkColor="#95D4B3">
                      {s.price}
                    </Text>
                  </RNView>
                </RNView>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {feedItems.length > 0 ? (
          <View style={styles.section} lightColor="transparent" darkColor="transparent">
            <Text style={styles.sectionTitle}>Обучение</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eduRow}>
              {feedItems.slice(0, 12).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push('/(app)/(tabs)/education')}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <View style={styles.eduCard} lightColor="#FFFFFF" darkColor="#0C1A14">
                    <Text style={styles.eduCardTitle} lightColor="#1A1A2E" darkColor="#FFFFFF" numberOfLines={3}>
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text style={styles.eduCardDesc} lightColor="rgba(11,27,20,0.55)" darkColor="rgba(255,255,255,0.55)" numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {faq.length > 0 ? (
          <View style={styles.section} lightColor="transparent" darkColor="transparent">
            <Text style={styles.sectionTitle}>Популярные вопросы</Text>
            <View style={styles.faqList} lightColor="transparent" darkColor="transparent">
              {faq.map((item) => {
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
  bellDot: {
    position: 'absolute',
    right: 9,
    top: 9,
    width: 7,
    height: 7,
    borderRadius: 9999,
    backgroundColor: '#B42318',
    borderWidth: 1,
    borderColor: '#FFFFFF',
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
  emptyAppointment: {
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    gap: 6,
  },
  emptyAppointmentTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  emptyAppointmentSub: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  bookAppointmentBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    minHeight: 48,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookAppointmentBtnText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  eduRow: {
    gap: 12,
    paddingRight: 8,
  },
  eduCard: {
    width: 220,
    minHeight: 110,
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  eduCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  eduCardDesc: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
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
  appointmentCard: {
    borderRadius: 20,
    padding: 16,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    gap: 12,
    overflow: 'hidden',
  },
  appointmentAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#75DAA8',
    opacity: 0.35,
  },
  appointmentTop: {
    gap: 4,
  },
  appointmentTitleMini: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    opacity: 0.9,
  },
  whenDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  whenDate: { 
    fontSize: 14, 
    fontWeight: '700' 
  },
  whenTime: { 
    fontSize: 24, 
    fontWeight: '700' 
  },
  statusPill: {
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(243,244,245,1)',
  },
  statusText: { 
    fontSize: 12, 
    fontWeight: '400' 
  },
  divider: {
     height: StyleSheet.hairlineWidth 
    },
  appointmentBottom: {
     flexDirection: 'row', 
     gap: 12, 
     alignItems: 'center' 
    },
  specAvatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 9999 
  },
  specInfo: { 
    flex: 1, 
    gap: 4 
  },
  specName: { 
    fontSize: 14, 
    fontWeight: '600' 
  },
  specService: { 
    fontSize: 13, 
    fontWeight: '400' 
  },
  appointmentAddrRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  address: { 
    flex: 1, 
    fontSize: 12, 
    fontWeight: '600' 
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnDisabled: {
    opacity: 0.55,
  },
  cancelText: { 
    fontSize: 14,
    fontWeight: 'medium' 
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
    minHeight: 212,
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
  },
  specCardFooter: {
    width: '100%',
    alignItems: 'center',
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
  specCardRole: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  specCardDivider: {
    marginTop: 0,
    width: '100%',
    height: StyleSheet.hairlineWidth,
  },
  specCardPrice: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '900',
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

