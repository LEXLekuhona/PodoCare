import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { loadProductsSnapshot } from '@/features/offline/products-screen-cache';
import { fetchStudioProducts, type StudioProductDto } from '@/features/products/products-api';
import { isProductFavorite, setProductFavorite } from '@/features/products/product-favorites-store';
import { loadSelectedStudio, type SelectedStudio } from '@/features/studio/local-studio-storage';
import { ApiError } from '@/shared/api/api-error';
import { sanitizeRouteParam } from '@/shared/navigation/route-params';
import { AppHeader } from '@/shared/ui/AppHeader';

const UNCATEGORIZED = 'Без категории';

type Product = {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  category: string;
  price: string;
  imageUrls: string[];
  isAvailable: boolean;
  stock: number | null;
};

function mapSnapshotItemToDto(
  item: Pick<
    StudioProductDto,
    'id' | 'name' | 'description' | 'category' | 'imageUrls' | 'priceMinor' | 'currency' | 'isAvailable' | 'stock'
  >,
): StudioProductDto {
  return {
    ...item,
    slug: item.id,
    brand: null,
    isAvailable: item.isAvailable ?? true,
    stock: item.stock ?? null,
  };
}

function mapDto(dto: StudioProductDto): Product {
  return {
    id: dto.id,
    title: dto.name,
    description: dto.description,
    brand: dto.brand,
    category: dto.category.trim() || UNCATEGORIZED,
    price: `${(dto.priceMinor / 100).toLocaleString('ru-RU')} ${dto.currency}`,
    imageUrls: dto.imageUrls,
    isAvailable: dto.isAvailable,
    stock: dto.stock,
  };
}

function ProductImage(props: { uri: string | null | undefined; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!props.uri || failed) {
    return (
      <RNView style={styles.imageFallback} accessibilityLabel={`Изображение товара ${props.title}`}>
        <FontAwesome name="picture-o" size={34} color="#2D6A4F" />
      </RNView>
    );
  }
  return (
    <Image
      source={{ uri: props.uri }}
      style={styles.productImage}
      resizeMode="cover"
      accessibilityLabel={`Изображение товара ${props.title}`}
      onError={() => setFailed(true)}
    />
  );
}

export function ProductDetailPage() {
  const insets = useSafeAreaInsets();
  const productId = sanitizeRouteParam(useLocalSearchParams().id);
  const [studio, setStudio] = useState<SelectedStudio | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingFavorite, setSavingFavorite] = useState(false);

  const load = useCallback(async () => {
    if (!productId) {
      setProduct(null);
      setError('Товар не найден');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const selectedStudio = await loadSelectedStudio();
      if (!selectedStudio?.id) {
        setStudio(null);
        setProduct(null);
        setError('Сначала выберите студию на главном экране');
        return;
      }

      setStudio(selectedStudio);
      setFavorite(await isProductFavorite(selectedStudio.id, productId));

      const disk = await loadProductsSnapshot();
      try {
        const list = await fetchStudioProducts(selectedStudio.id);
        const found = list.find((item) => item.id === productId);
        if (!found) {
          setProduct(null);
          setError('Товар не найден в выбранной студии');
          return;
        }
        setProduct(mapDto(found));
      } catch (e) {
        const cached = disk?.studioId === selectedStudio.id
          ? disk.items.map(mapSnapshotItemToDto).find((item) => item.id === productId)
          : null;
        if (cached) {
          setProduct(mapDto(cached));
          return;
        }
        setProduct(null);
        setError(e instanceof ApiError ? e.message : 'Не удалось загрузить товар');
      }
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFavorite = useCallback(async () => {
    if (!studio?.id || !product?.id) return;
    setSavingFavorite(true);
    try {
      const nextFavorite = !favorite;
      await setProductFavorite(studio.id, product.id, nextFavorite);
      setFavorite(nextFavorite);
    } finally {
      setSavingFavorite(false);
    }
  }, [favorite, product?.id, studio?.id]);

  return (
    <View style={styles.root} lightColor="#F8F9FA" darkColor="#06130E">
      <AppHeader
        title={product?.title ?? 'Товар'}
        titleNumberOfLines={1}
        titleStyle={styles.headerTitle}
        onBackPress={() => router.back()}
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(24, insets.bottom + 24) }]}>
        {loading ? (
          <View style={styles.loader} lightColor="transparent" darkColor="transparent">
            <ActivityIndicator />
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.errorCard} lightColor="#FFFFFF" darkColor="#0C1A14">
            <Text style={styles.errorText} lightColor="#93000A" darkColor="#FFB4A9">
              {error}
            </Text>
            <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
              <Text style={styles.retryBtnText}>Повторить</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && product ? (
          <>
            <View style={styles.heroCard} lightColor="#FFFFFF" darkColor="#0C1A14">
              <ProductImage uri={product.imageUrls[0]} title={product.title} />
              <View style={styles.heroBody} lightColor="transparent" darkColor="transparent">
                <View style={styles.metaRow} lightColor="transparent" darkColor="transparent">
                  <Text style={styles.categoryText} lightColor="#2D6A4F" darkColor="#95D4B3">
                    {product.category}
                  </Text>
                  {favorite ? (
                    <View style={styles.favoriteBadge} lightColor="rgba(45,106,79,0.10)" darkColor="rgba(149,212,179,0.14)">
                      <FontAwesome name="heart" size={12} color="#2D6A4F" />
                      <Text style={styles.favoriteBadgeText} lightColor="#2D6A4F" darkColor="#95D4B3">
                        В избранном
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.title}>{product.title}</Text>
                {product.brand ? (
                  <Text style={styles.brandText} lightColor="rgba(11,27,20,0.55)" darkColor="rgba(255,255,255,0.55)">
                    {product.brand}
                  </Text>
                ) : null}
                <Text style={styles.price} lightColor="#2D6A4F" darkColor="#95D4B3">
                  {product.price}
                </Text>
              </View>
            </View>

            <View style={styles.infoCard} lightColor="#FFFFFF" darkColor="#0C1A14">
              <Text style={styles.sectionTitle}>Описание</Text>
              <Text style={styles.description} lightColor="rgba(11,27,20,0.68)" darkColor="rgba(255,255,255,0.70)">
                {product.description?.trim() || 'Описание уточним на приёме.'}
              </Text>
            </View>

            <View style={styles.infoCard} lightColor="#FFFFFF" darkColor="#0C1A14">
              <Text style={styles.sectionTitle}>Покупка в студии</Text>
              <View style={styles.detailRow} lightColor="transparent" darkColor="transparent">
                <FontAwesome name="map-marker" size={18} color="#2D6A4F" />
                <Text style={styles.detailText} lightColor="rgba(11,27,20,0.68)" darkColor="rgba(255,255,255,0.70)">
                  Цена и наличие показаны для выбранной студии: {studio?.name ?? 'студия'}
                </Text>
              </View>
              <View style={styles.detailRow} lightColor="transparent" darkColor="transparent">
                <FontAwesome name="info-circle" size={16} color="#2D6A4F" />
                <Text style={styles.detailText} lightColor="rgba(11,27,20,0.68)" darkColor="rgba(255,255,255,0.70)">
                  {product.isAvailable
                    ? product.stock == null
                      ? 'Товар отмечен как доступный в выбранной студии.'
                      : `В наличии: ${product.stock} шт.`
                    : 'Сейчас товара нет в наличии в выбранной студии.'}
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              disabled={savingFavorite}
              onPress={toggleFavorite}
              style={({ pressed }) => [
                styles.favoriteBtn,
                favorite && styles.favoriteBtnActive,
                (pressed || savingFavorite) && styles.pressed,
              ]}
            >
              <FontAwesome name={favorite ? 'heart' : 'heart-o'} size={18} color="#FFFFFF" />
              <Text style={styles.favoriteBtnText}>
                {favorite ? 'В избранном' : 'Добавить в избранное'}
              </Text>
            </Pressable>
          </>
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
  },
  content: {
    padding: 16,
    gap: 14,
  },
  loader: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  errorCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(186,26,26,0.30)',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  heroCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.30)',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  productImage: {
    width: '100%',
    height: 220,
    backgroundColor: 'rgba(45,106,79,0.08)',
  },
  imageFallback: {
    width: '100%',
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45,106,79,0.10)',
  },
  heroBody: {
    padding: 16,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  categoryText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  favoriteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 9999,
  },
  favoriteBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: '#1A1A2E',
    fontFamily: Platform.select({ ios: 'Liberation Serif', android: 'serif' }),
  },
  brandText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  price: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  infoCard: {
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.30)',
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  favoriteBtn: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  favoriteBtnActive: {
    backgroundColor: '#0F5238',
  },
  favoriteBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  pressed: {
    opacity: 0.85,
  },
});
