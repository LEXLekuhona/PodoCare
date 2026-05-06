import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { fetchStudioDirectionBySlug, type StudioDirectionDto } from '@/features/booking/booking-api';
import { ApiError } from '@/shared/api/api-error';
import { sanitizeRouteParam } from '@/shared/navigation/route-params';
import { AppHeader } from '@/shared/ui/AppHeader';

export function StudioDirectionPage() {
  const insets = useSafeAreaInsets();
  const slug = sanitizeRouteParam(useLocalSearchParams().slug);
  const [item, setItem] = useState<StudioDirectionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) {
      setItem(null);
      setError('Направление не найдено');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await fetchStudioDirectionBySlug(slug);
      setItem(next);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Не удалось загрузить направление';
      setError(msg);
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const headerTitle = item?.title ?? 'Направление';

  return (
    <View style={styles.root} lightColor="#F8F9FA" darkColor="#06130E">
      <AppHeader
        title={headerTitle}
        titleStyle={styles.headerTitle}
        titleNumberOfLines={3}
        onBackPress={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(24, 16 + insets.bottom) },
        ]}
      >
        {loading ? (
          <View style={styles.loader} lightColor="transparent" darkColor="transparent">
            <ActivityIndicator />
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
            <Text style={styles.description} lightColor="#93000A" darkColor="#FFB4A9">
              {error}
            </Text>
            <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
              <Text style={styles.retryBtnText} lightColor="#FFFFFF" darkColor="#06130E">
                Повторить
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && item ? (
          <View style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
            <Text style={styles.description} lightColor="rgba(11,27,20,0.65)" darkColor="rgba(255,255,255,0.70)">
              {item.description?.trim() || 'Описание пока не добавлено.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerTitle: {
    textAlign: 'center',
    maxWidth: '88%',
    fontSize: 16,
    lineHeight: 21,
  },
  content: {
    padding: 16,
  },
  loader: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  card: {
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.30)',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  retryBtn: {
    alignSelf: 'flex-start',
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D6A4F',
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
