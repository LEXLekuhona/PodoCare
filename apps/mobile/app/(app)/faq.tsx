import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View as RNView } from 'react-native';

import { Text, View } from '@/components/Themed';
import { fetchFaqItems, type FaqItemDto } from '@/features/faq/faq-api';
import { ApiError } from '@/shared/api/api-error';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

const GREEN = '#2D6A4F';

function loadErrorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Не удалось загрузить вопросы';
}

export default function FaqScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FaqItemDto[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFaqItems();
      setItems(data);
    } catch (e: unknown) {
      setError(loadErrorMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
            Частые вопросы
          </Text>
          <RNView style={styles.headerSideBtn} />
        </RNView>
      </SafeAreaPadding>

      {loading ? (
        <RNView style={styles.centered}>
          <ActivityIndicator />
        </RNView>
      ) : error ? (
        <RNView style={styles.centered}>
          <Text style={styles.errorText} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.9)">
            {error}
          </Text>
          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
            <Text style={styles.retryBtnText} lightColor="#FFFFFF" darkColor="#FFFFFF">
              Повторить
            </Text>
          </Pressable>
        </RNView>
      ) : items.length === 0 ? (
        <RNView style={styles.centered}>
          <Text style={styles.emptyText} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
            Пока нет опубликованных вопросов.
          </Text>
        </RNView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.faqList} lightColor="transparent" darkColor="transparent">
            {items.map((item) => {
              const open = expandedId === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setExpandedId((v) => (v === item.id ? null : item.id))}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <View style={styles.faqItem} lightColor="#FFFFFF" darkColor="#0C1A14">
                    <View style={styles.faqTop} lightColor="transparent" darkColor="transparent">
                      <Text style={styles.faqQ} lightColor="#1A1A2E" darkColor="#FFFFFF">
                        {item.question}
                      </Text>
                      <FontAwesome
                        name={open ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color="rgba(112,121,115,1)"
                      />
                    </View>
                    {open ? (
                      <Text style={styles.faqA} lightColor="rgba(112,121,115,1)" darkColor="rgba(149,163,160,0.85)">
                        {item.answer}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topNav: {
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  faqList: {
    gap: 12,
  },
  faqItem: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: GREEN,
  },
  retryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  pressed: {
    opacity: 0.85,
  },
});
