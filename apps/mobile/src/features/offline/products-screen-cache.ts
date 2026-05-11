import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StudioProductDto } from '@/features/products/products-api';

const KEY = 'srs.snapshot.products.v1';

export type ProductsScreenSnapshotV1 = {
  v: 1;
  studioId: string;
  items: Pick<
    StudioProductDto,
    'id' | 'name' | 'description' | 'category' | 'imageUrls' | 'priceMinor' | 'currency' | 'isAvailable' | 'stock'
  >[];
};

export async function loadProductsSnapshot(): Promise<ProductsScreenSnapshotV1 | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ProductsScreenSnapshotV1;
    if (data?.v !== 1 || typeof data.studioId !== 'string') return null;
    if (!Array.isArray(data.items)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function saveProductsSnapshot(snapshot: ProductsScreenSnapshotV1): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(snapshot));
}

export async function clearProductsSnapshot(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
