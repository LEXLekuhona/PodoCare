import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ComponentProps } from 'react';
import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { getSupportEmail, getSupportPhoneE164 } from '@/shared/config/support';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

const GREEN = '#2D6A4F';

export function SupportChatPage() {
  const email = getSupportEmail();
  const phone = getSupportPhoneE164();

  const openTel = () => {
    if (!phone) return;
    void Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={styles.root} lightColor="#F8F9FA" darkColor="#06130E">
      <SafeAreaPadding minTop={10} minBottom={0} style={styles.topNav} lightColor="transparent" darkColor="transparent">
        <RNView style={styles.headerRow}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(app)/(tabs)/profile');
            }}
            accessibilityLabel="Назад"
            style={({ pressed }) => [styles.headerSideBtn, pressed && styles.pressed]}
          >
            <Text style={styles.backGlyph} lightColor="#2D6A4F" darkColor="#95D4B3">
              ‹
            </Text>
          </Pressable>
          <Text style={styles.headerTitle} lightColor={GREEN} darkColor="#95D4B3">
            Поддержка
          </Text>
          <RNView style={styles.headerSideBtn} />
        </RNView>
      </SafeAreaPadding>

      <RNView style={styles.main}>
        <Text style={styles.lead} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
          Онлайн-чат в приложении появится позже. Пока вы можете написать нам или посмотреть ответы в разделе вопросов.
        </Text>

        <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
          <SupportRow
            icon="question-circle-o"
            title="Частые вопросы"
            subtitle="Ответы без ожидания оператора"
            onPress={() => router.push('/(app)/faq')}
          />
          <RowDivider />
          <SupportRow
            icon="commenting-o"
            title="Написать в поддержку"
            subtitle="Сообщение отправится прямо в систему"
            onPress={() => router.push('/(app)/support-chat' as never)}
          />
          <RowDivider />
          <SupportRow
            icon="phone"
            title="Позвонить"
            subtitle={phone ?? 'Укажите EXPO_PUBLIC_SUPPORT_PHONE (E.164, напр. +74951234567)'}
            onPress={phone ? openTel : undefined}
            dimmed={!phone}
          />
          {email ? (
            <>
              <RowDivider />
              <SupportRow
                icon="envelope-o"
                title="Почта поддержки"
                subtitle={email}
                dimmed
              />
            </>
          ) : null}
        </View>
      </RNView>
    </View>
  );
}

function RowDivider() {
  return <View style={styles.divider} lightColor="rgba(149,163,160,0.25)" darkColor="rgba(255,255,255,0.08)" />;
}

function SupportRow(props: {
  icon: ComponentProps<typeof FontAwesome>['name'];
  title: string;
  subtitle: string;
  onPress?: () => void;
  dimmed?: boolean;
}) {
  const body = (
    <RNView style={[styles.rowInner, props.dimmed && styles.rowDimmed]}>
      <RNView style={styles.iconSlot}>
        <FontAwesome name={props.icon} size={20} color={props.dimmed ? 'rgba(112,121,115,0.5)' : GREEN} />
      </RNView>
      <RNView style={styles.rowText}>
        <Text style={styles.rowTitle} lightColor="#1A1A2E" darkColor="#FFFFFF">
          {props.title}
        </Text>
        <Text style={styles.rowSub} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
          {props.subtitle}
        </Text>
      </RNView>
      <FontAwesome name="chevron-right" size={14} color="rgba(112,121,115,0.6)" />
    </RNView>
  );

  if (props.onPress) {
    return (
      <Pressable onPress={props.onPress} style={({ pressed }) => [styles.rowPress, pressed && styles.pressed]}>
        {body}
      </Pressable>
    );
  }

  return <RNView style={styles.rowPress}>{body}</RNView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topNav: { paddingHorizontal: 8, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSideBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { fontSize: 28, fontWeight: '300' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  main: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  lead: { fontSize: 15, lineHeight: 22, fontWeight: '500', fontFamily: 'Inter_500Medium', marginBottom: 18 },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    overflow: 'hidden',
  },
  rowPress: {},
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowDimmed: { opacity: 0.72 },
  iconSlot: { width: 32, alignItems: 'center' },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  rowSub: { fontSize: 13, lineHeight: 18, fontWeight: '500', fontFamily: 'Inter_500Medium' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 58 },
  pressed: { opacity: 0.88 },
});
