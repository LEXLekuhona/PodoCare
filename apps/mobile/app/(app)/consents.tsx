import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { fetchMyConsents, type ClientConsentDto } from '@/features/consents/consents-api';
import { ApiError } from '@/shared/api/api-error';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

const GREEN = '#2D6A4F';

function formatSignedDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function MyConsentsScreen() {
  const [items, setItems] = useState<ClientConsentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchMyConsents();
      setItems(list);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить документы');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <View style={styles.root} lightColor="#F8F9FA" darkColor="#06130E">
      <SafeAreaPadding minTop={10} minBottom={0} style={styles.safeTop} lightColor="transparent" darkColor="transparent">
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
            Документы
          </Text>
          <RNView style={styles.headerSideBtn} />
        </RNView>
      </SafeAreaPadding>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1} lightColor="#1A1A2E" darkColor="#FFFFFF">
          Мои согласия
        </Text>
        <Text style={styles.intro} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
          Здесь хранятся все подписанные вами документы и согласия на медицинские вмешательства.
        </Text>

        {loading ? (
          <RNView style={styles.loaderWrap}>
            <ActivityIndicator />
          </RNView>
        ) : null}

        {error ? (
          <Pressable onPress={() => void reload()} style={({ pressed }) => [styles.errorBanner, pressed && styles.pressed]}>
            <Text style={styles.errorText} lightColor="#93000A" darkColor="#FFB4A9">
              {error}. Нажмите, чтобы повторить.
            </Text>
          </Pressable>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <View style={styles.emptyCard} lightColor="#FFFFFF" darkColor="#0C1A14">
            <Text style={styles.emptyTitle} lightColor="#1A1A2E" darkColor="#FFFFFF">
              Пока нет подписанных документов
            </Text>
            <Text style={styles.emptySub} lightColor="rgba(11,27,20,0.55)" darkColor="rgba(255,255,255,0.55)">
              После принятия согласий при регистрации они появятся в этом списке.
            </Text>
          </View>
        ) : null}

        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() =>
              router.push({
                pathname: '/(app)/consent-document',
                params: { type: item.type },
              })
            }
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.cardInner} lightColor="#FFFFFF" darkColor="#0C1A14">
              <RNView style={styles.cardTop}>
                <RNView style={styles.badgeActive}>
                  <Text style={styles.badgeActiveText} lightColor="#0F5238" darkColor="#95D4B3">
                    АКТИВНО
                  </Text>
                </RNView>
                <RNView style={styles.cardTopRight}>
                  <RNView style={styles.chevronCircle}>
                    <FontAwesome name="chevron-right" size={14} color={GREEN} />
                  </RNView>
                </RNView>
              </RNView>
              <Text style={styles.versionLine} lightColor="rgba(11,27,20,0.45)" darkColor="rgba(255,255,255,0.45)">
                Версия {item.documentVersion}
              </Text>
              <Text style={styles.docTitle} lightColor="#1A1A2E" darkColor="#FFFFFF">
                {item.title}
              </Text>
              <RNView style={styles.signedRow}>
                <FontAwesome name="file-text-o" size={14} color={ICON_META} />
                <Text style={styles.signedText} lightColor="rgba(64,73,67,1)" darkColor="rgba(149,163,160,0.9)">
                  Подписано: {formatSignedDate(item.signedAt)}
                </Text>
              </RNView>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const ICON_META = 'rgba(112,121,115,1)';

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeTop: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSideBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    fontSize: 28,
    fontWeight: '300',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  h1: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontFamily: Platform.select({ ios: 'Liberation Serif', android: 'serif' }),
  },
  intro: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
  },
  loaderWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  errorBanner: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: 'rgba(186,26,26,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(186,26,26,0.25)',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  emptyCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  emptySub: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
  },
  card: {
    marginBottom: 4,
  },
  cardInner: {
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    gap: 8,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  badgeActive: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(177,240,206,0.45)',
  },
  badgeActiveText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  cardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevronCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45,106,79,0.12)',
  },
  versionLine: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  docTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  signedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  signedText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  pressed: { opacity: 0.9 },
});
