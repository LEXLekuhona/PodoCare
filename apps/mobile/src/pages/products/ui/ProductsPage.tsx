import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { fetchStudioProducts, type StudioProductDto } from '@/features/products/products-api';
import { loadSelectedStudio } from '@/features/studio/local-studio-storage';
import { ApiError } from '@/shared/api/api-error';
import { LeafLogo } from '@/shared/ui/icons/LeafLogo';
import { SafeAreaPadding } from '@/shared/ui/safe-area';

type CategoryId = 'all' | string;

type Product = {
  id: string;
  title: string;
  subtitle: string | null;
  price: string;
  category: string;
  featured?: boolean;
  imageUrls: string[];
};

const UNCATEGORIZED = 'Без категории';

function iconForProduct(p: Product): React.ComponentProps<typeof FontAwesome>['name'] {
  const category = p.category.toLowerCase();
  if (category.includes('инстру')) return 'wrench';
  if (category.includes('крем') || category.includes('маз')) return 'tint';
  if (category.includes('уход')) return 'leaf';
  return 'leaf';
}

function mapDto(dto: StudioProductDto, index: number): Product {
  const category = dto.category.trim() || UNCATEGORIZED;
  return {
    id: dto.id,
    title: dto.name,
    subtitle: dto.description,
    price: `${(dto.priceMinor / 100).toLocaleString('ru-RU')} ${dto.currency}`,
    category,
    featured: index < 6,
    imageUrls: dto.imageUrls,
  };
}

export function ProductsPage() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<CategoryId>('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const studio = await loadSelectedStudio();
      if (!studio?.id) {
        setProducts([]);
        setError('Сначала выберите студию на главном экране');
        return;
      }
      const list = await fetchStudioProducts(studio.id);
      setProducts(list.map(mapDto));
    } catch (e) {
      setProducts([]);
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить товары');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const uniq = Array.from(new Set(products.map((p) => p.category)));
    return [{ id: 'all', label: 'Все' }, ...uniq.map((x) => ({ id: x, label: x }))];
  }, [products]);

  useEffect(() => {
    if (!categories.some((c) => c.id === category)) {
      setCategory('all');
    }
  }, [categories, category]);

  const featured = useMemo(() => products.filter((p) => p.featured), [products]);
  const catalog = useMemo(
    () => (category === 'all' ? products : products.filter((p) => p.category === category)),
    [category, products]
  );

  const contentBottom = Math.max(insets.bottom, 16) + 24;

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
          <Pressable hitSlop={12} style={styles.iconBtn} onPress={() => {}}>
            <FontAwesome name="shopping-bag" size={18} color="#2D6A4F" />
          </Pressable>
        </View>
      </SafeAreaPadding>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]}>
        <View style={styles.hero} lightColor="transparent" darkColor="transparent">
          <Text style={styles.heroTitle}>Витрина студии</Text>
          <Text style={styles.heroSub} lightColor="rgba(11,27,20,0.65)" darkColor="rgba(255,255,255,0.65)">
            Средства и аксессуары, которые мы рекомендуем для домашнего ухода после приёма.
          </Text>
        </View>

        <Pressable onPress={() => {}} style={({ pressed }) => [pressed && styles.pressed]}>
          <View style={styles.searchPill} lightColor="#FFFFFF" darkColor="#0C1A14">
            <FontAwesome name="search" size={16} color="rgba(11,27,20,0.45)" />
            <Text style={styles.searchPlaceholder} lightColor="rgba(11,27,20,0.45)" darkColor="rgba(255,255,255,0.45)">
              Поиск по товарам
            </Text>
          </View>
        </Pressable>

        <View style={styles.section} lightColor="transparent" darkColor="transparent">
          <Text style={styles.sectionTitle}>Категории</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {categories.map((c) => {
              const active = c.id === category;
              return (
                <Pressable key={c.id} onPress={() => setCategory(c.id)} style={({ pressed }) => [pressed && styles.pressed]}>
                  <View style={[styles.chip, active && styles.chipActive]} lightColor="#FFFFFF" darkColor="#0C1A14">
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                      lightColor={active ? '#2D6A4F' : 'rgba(11,27,20,0.75)'}
                      darkColor={active ? '#95D4B3' : 'rgba(255,255,255,0.75)'}
                    >
                      {c.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section} lightColor="transparent" darkColor="transparent">
          <View style={styles.sectionRow} lightColor="transparent" darkColor="transparent">
            <Text style={styles.sectionTitle}>Рекомендуем</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
            {featured.map((p) => (
              <Pressable key={p.id} onPress={() => {}} style={({ pressed }) => [pressed && styles.pressed]}>
                <View style={styles.featuredCard} lightColor="#FFFFFF" darkColor="#0C1A14">
                  <RNView style={styles.featuredIconWrap}>
                    <FontAwesome name={iconForProduct(p)} size={22} color="#2D6A4F" />
                  </RNView>
                  <RNView style={styles.featuredBody}>
                    <RNView style={styles.featuredTextBlock}>
                      <Text style={styles.featuredName}>{p.title}</Text>
                      <Text
                        style={styles.featuredSub}
                        lightColor="rgba(112,121,115,1)"
                        darkColor="rgba(149,163,160,0.85)"
                      >
                        {p.subtitle ?? 'Описание уточним на приёме'}
                      </Text>
                    </RNView>
                    <RNView style={styles.featuredFooter}>
                      <View style={styles.featuredDivider} lightColor="rgba(191,201,193,0.35)" darkColor="rgba(255,255,255,0.10)" />
                      <Text style={styles.featuredPrice} lightColor="#2D6A4F" darkColor="#95D4B3">
                        {p.price}
                      </Text>
                    </RNView>
                  </RNView>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section} lightColor="transparent" darkColor="transparent">
          <Text style={styles.sectionTitle}>
            {category === 'all' ? 'Все товары' : categories.find((c) => c.id === category)?.label}
          </Text>
          {loading ? (
            <Text style={styles.listSub} lightColor="rgba(11,27,20,0.55)" darkColor="rgba(255,255,255,0.55)">
              Загрузка...
            </Text>
          ) : error ? (
            <Text style={styles.listSub} lightColor="rgba(11,27,20,0.55)" darkColor="rgba(255,255,255,0.55)">
              {error}
            </Text>
          ) : catalog.length === 0 ? (
            <Text style={styles.listSub} lightColor="rgba(11,27,20,0.55)" darkColor="rgba(255,255,255,0.55)">
              Для выбранной категории пока нет товаров
            </Text>
          ) : null}
          <View style={styles.list} lightColor="transparent" darkColor="transparent">
            {catalog.map((p) => (
              <Pressable key={p.id} onPress={() => {}} style={({ pressed }) => [pressed && styles.pressed]}>
                <View style={styles.listCard} lightColor="#FFFFFF" darkColor="#0C1A14">
                  <View style={styles.listThumb} lightColor="rgba(45,106,79,0.10)" darkColor="rgba(149,212,179,0.14)">
                    <FontAwesome name="picture-o" size={20} color="#2D6A4F" />
                  </View>
                  <View style={styles.listMain} lightColor="transparent" darkColor="transparent">
                    <View style={styles.listTop} lightColor="transparent" darkColor="transparent">
                      <Text style={styles.listTitle}>{p.title}</Text>
                    </View>
                    <Text style={styles.listSub} lightColor="rgba(11,27,20,0.55)" darkColor="rgba(255,255,255,0.55)">
                      {p.subtitle ?? 'Описание уточним на приёме'}
                    </Text>
                    <Text style={styles.listPrice} lightColor="#2D6A4F" darkColor="#95D4B3">
                      {p.price}
                    </Text>
                  </View>
                  <FontAwesome name="chevron-right" size={14} color="rgba(112,121,115,1)" />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
    justifyContent: 'center',
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
  },
  content: {
    padding: 16,
    gap: 14,
  },
  hero: {
    gap: 8,
    paddingTop: 8,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: '#1A1A2E',
    fontFamily: Platform.select({ ios: 'Liberation Serif', android: 'serif' }),
  },
  heroSub: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(191,201,193,0.45)',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  searchPlaceholder: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    gap: 10,
    paddingTop: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontFamily: Platform.select({ ios: 'Liberation Serif', android: 'serif' }),
    color: '#1A1A2E',
  },
  chipsRow: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
  },
  chipActive: {
    backgroundColor: 'rgba(45,106,79,0.10)',
    borderColor: 'rgba(45,106,79,0.35)',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextActive: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  featuredRow: {
    gap: 14,
    paddingRight: 8,
    alignItems: 'stretch',
  },
  featuredCard: {
    width: 176,
    minHeight: 200,
    alignSelf: 'stretch',
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    alignItems: 'center',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 9999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  featuredIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45,106,79,0.10)',
    marginBottom: 10,
  },
  featuredBody: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  featuredTextBlock: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  featuredName: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  featuredSub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  featuredFooter: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  featuredDivider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
  },
  featuredPrice: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '900',
  },
  list: {
    gap: 10,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149,163,160,0.35)',
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  listThumb: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listMain: {
    flex: 1,
    gap: 4,
  },
  listTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  listTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  listBadge: {
    borderRadius: 9999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  listBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listSub: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  listPrice: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.85,
  },
});
