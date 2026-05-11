import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { loadProductsSnapshot } from '@/features/offline/products-screen-cache';
import {
  addFavoriteUnits,
  loadFavoriteEntries,
  setProductFavorite,
  type FavoriteLine,
} from '@/features/products/product-favorites-store';
import { fetchStudioProducts, type StudioProductDto } from '@/features/products/products-api';
import { loadSelectedStudio } from '@/features/studio/local-studio-storage';
import { ApiError } from '@/shared/api/api-error';
import {
  USER_OFFLINE_NO_CACHED_DATA,
  USER_SERVER_NO_CACHED_DATA,
} from '@/shared/api/user-facing-errors';
import { fetchIsOffline } from '@/shared/network/connectivity';
import { AppHeader } from '@/shared/ui/AppHeader';

type Row = FavoriteLine & {
  title: string;
  price: string;
  missingFromCatalog: boolean;
};

function mapSnapshotItemToDto(
  item: Pick<StudioProductDto, 'id' | 'name' | 'description' | 'category' | 'imageUrls' | 'priceMinor' | 'currency'>,
): StudioProductDto {
  return {
    ...item,
    slug: item.id,
    brand: null,
    isAvailable: true,
    stock: null,
  };
}

function formatPrice(dto: Pick<StudioProductDto, 'priceMinor' | 'currency'>): string {
  return `${(dto.priceMinor / 100).toLocaleString('ru-RU')} ${dto.currency}`;
}

export function ProductFavoritesPage() {
  const insets = useSafeAreaInsets();
  const [studioId, setStudioId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEmptyMessage(null);
    try {
      const studio = await loadSelectedStudio();
      if (!studio?.id) {
        setStudioId(null);
        setRows([]);
        setError('Сначала выберите студию на главном экране');
        return;
      }
      setStudioId(studio.id);

      const lines = await loadFavoriteEntries(studio.id);
      if (lines.length === 0) {
        setRows([]);
        return;
      }

      const byId = new Map<string, StudioProductDto>();
      const disk = await loadProductsSnapshot();
      const offline = await fetchIsOffline();

      if (offline) {
        if (disk != null && disk.studioId === studio.id) {
          for (const it of disk.items) byId.set(it.id, mapSnapshotItemToDto(it));
        } else {
          setRows([]);
          setEmptyMessage(USER_OFFLINE_NO_CACHED_DATA);
          return;
        }
      } else {
        try {
          const list = await fetchStudioProducts(studio.id);
          for (const p of list) byId.set(p.id, p);
        } catch (e) {
          if (disk != null && disk.studioId === studio.id) {
            for (const it of disk.items) byId.set(it.id, mapSnapshotItemToDto(it));
            setError(null);
            setEmptyMessage(null);
          } else {
            setRows([]);
            setEmptyMessage(USER_SERVER_NO_CACHED_DATA);
            setError(e instanceof ApiError ? e.message : 'Не удалось загрузить товары');
            return;
          }
        }
      }

      const nextRows: Row[] = [];
      for (const line of lines) {
        const dto = byId.get(line.productId);
        if (!dto) {
          nextRows.push({
            ...line,
            title: 'Товар недоступен',
            price: '—',
            missingFromCatalog: true,
          });
          continue;
        }
        nextRows.push({
          ...line,
          title: dto.name,
          price: formatPrice(dto),
          missingFromCatalog: false,
        });
      }
      setRows(nextRows);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const withBusy = useCallback(async (productId: string, fn: () => Promise<void>) => {
    setBusyId(productId);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  }, []);

  const onRemove = useCallback(
    (productId: string) => {
      if (!studioId) return;
      void withBusy(productId, async () => {
        await setProductFavorite(studioId, productId, false);
        await load();
      });
    },
    [studioId, withBusy, load],
  );

  const onMinus = useCallback(
    (productId: string, quantity: number) => {
      if (!studioId) return;
      void withBusy(productId, async () => {
        if (quantity <= 1) await setProductFavorite(studioId, productId, false);
        else await addFavoriteUnits(studioId, productId, -1);
        await load();
      });
    },
    [studioId, withBusy, load],
  );

  const onPlus = useCallback(
    (productId: string) => {
      if (!studioId) return;
      void withBusy(productId, async () => {
        await addFavoriteUnits(studioId, productId, 1);
        await load();
      });
    },
    [studioId, withBusy, load],
  );

  const openProduct = useCallback((productId: string) => {
    router.push(`/(app)/product/${productId}` as any);
  }, []);

  const bottomPad = Math.max(24, insets.bottom + 24);

  return (
    <View style={styles.root} lightColor="#F8F9FA" darkColor="#06130E">
      <AppHeader title="Избранное" titleStyle={styles.headerTitle} onBackPress={() => router.back()} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        {loading ? (
          <View style={styles.loader} lightColor="transparent" darkColor="transparent">
            <ActivityIndicator />
          </View>
        ) : null}

        {!loading && error ? (
          <Text style={styles.message} lightColor="#1A1A2E" darkColor="#FFFFFF">
            {error}
          </Text>
        ) : null}

        {!loading && !error && emptyMessage != null ? (
          <Text style={styles.message} lightColor="#1A1A2E" darkColor="#FFFFFF">
            {emptyMessage}
          </Text>
        ) : null}

        {!loading && !error && emptyMessage == null && rows.length === 0 ? (
          <View style={styles.emptyWrap} lightColor="transparent" darkColor="transparent">
            <FontAwesome name="heart-o" size={40} color="#2D6A4F" />
            <Text style={styles.emptyTitle} lightColor="#1A1A2E" darkColor="#FFFFFF">
              Пока пусто
            </Text>
            <Text style={styles.emptySub} lightColor="rgba(11,27,20,0.6)" darkColor="rgba(255,255,255,0.6)">
              Добавляйте товары в избранное из каталога или карточки товара
            </Text>
          </View>
        ) : null}

        {!loading && !error && emptyMessage == null && rows.length > 0 ? (
          <View style={styles.list} lightColor="transparent" darkColor="transparent">
            {rows.map((r) => {
              const locked = busyId === r.productId;
              return (
                <View key={r.productId} style={styles.card} lightColor="#FFFFFF" darkColor="#0C1A14">
                  <Pressable
                    onPress={() => openProduct(r.productId)}
                    style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
                    disabled={locked || r.missingFromCatalog}
                  >
                    <RNView style={styles.thumb} accessibilityLabel="">
                      <FontAwesome name="picture-o" size={20} color="#2D6A4F" />
                    </RNView>
                    <View style={styles.cardText} lightColor="transparent" darkColor="transparent">
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {r.title}
                      </Text>
                      <Text style={styles.cardPrice} lightColor="#2D6A4F" darkColor="#95D4B3">
                        {r.price}
                      </Text>
                    </View>
                  </Pressable>

                  <RNView style={styles.cardActions}>
                    <RNView style={styles.stepper}>
                      <Pressable
                        hitSlop={8}
                        style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel="Уменьшить количество"
                        disabled={locked}
                        onPress={() => onMinus(r.productId, r.quantity)}
                      >
                        <FontAwesome name="minus" size={12} color="#2D6A4F" />
                      </Pressable>
                      <Text
                        style={styles.stepQty}
                        lightColor="#1A1A2E"
                        darkColor="#FFFFFF"
                      >
                        {r.quantity}
                      </Text>
                      <Pressable
                        hitSlop={8}
                        style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel="Увеличить количество"
                        disabled={locked}
                        onPress={() => onPlus(r.productId)}
                      >
                        <FontAwesome name="plus" size={12} color="#2D6A4F" />
                      </Pressable>
                    </RNView>
                    <Pressable
                      hitSlop={8}
                      style={({ pressed }) => [styles.trashBtn, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel="Удалить из избранного"
                      disabled={locked}
                      onPress={() => onRemove(r.productId)}
                    >
                      <FontAwesome name="trash-o" size={18} color="rgba(112,121,115,1)" />
                    </Pressable>
                  </RNView>
                </View>
              );
            })}
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
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F5238',
  },
  content: {
    padding: 16,
    flexGrow: 1,
  },
  loader: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  emptyWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Liberation Serif', android: 'serif' }),
  },
  emptySub: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  list: {
    gap: 12,
  },
  card: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45,106,79,0.10)',
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '900',
  },
  cardActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.45)',
    overflow: 'hidden',
  },
  stepBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45,106,79,0.08)',
  },
  stepQty: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
  },
  trashBtn: {
    padding: 6,
  },
  pressed: {
    opacity: 0.85,
  },
});
