import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'srs.productFavorites.v1';

const MAX_QTY = 999;

type ProductFavoritesStateV1 = {
  v: 1;
  byStudioId: Record<string, string[]>;
};

type ProductFavoritesStateV2 = {
  v: 2;
  byStudioId: Record<string, Record<string, number>>;
};

function normalizeV1(raw: unknown): ProductFavoritesStateV1 {
  if (
    raw != null &&
    typeof raw === 'object' &&
    (raw as ProductFavoritesStateV1).v === 1 &&
    typeof (raw as ProductFavoritesStateV1).byStudioId === 'object' &&
    (raw as ProductFavoritesStateV1).byStudioId != null
  ) {
    const byStudioId: Record<string, string[]> = {};
    for (const [studioId, ids] of Object.entries((raw as ProductFavoritesStateV1).byStudioId)) {
      if (typeof studioId !== 'string' || !Array.isArray(ids)) continue;
      byStudioId[studioId] = Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0)));
    }
    return { v: 1, byStudioId };
  }
  return { v: 1, byStudioId: {} };
}

function migrateV1ToV2(v1: ProductFavoritesStateV1): ProductFavoritesStateV2 {
  const byStudioId: Record<string, Record<string, number>> = {};
  for (const [studioId, ids] of Object.entries(v1.byStudioId)) {
    const m: Record<string, number> = {};
    for (const id of ids) m[id] = 1;
    byStudioId[studioId] = m;
  }
  return { v: 2, byStudioId };
}

function normalizeV2(raw: unknown): ProductFavoritesStateV2 {
  if (
    raw != null &&
    typeof raw === 'object' &&
    (raw as ProductFavoritesStateV2).v === 2 &&
    typeof (raw as ProductFavoritesStateV2).byStudioId === 'object' &&
    (raw as ProductFavoritesStateV2).byStudioId != null
  ) {
    const byStudioId: Record<string, Record<string, number>> = {};
    for (const [studioId, map] of Object.entries((raw as ProductFavoritesStateV2).byStudioId)) {
      if (typeof studioId !== 'string' || map == null || typeof map !== 'object') continue;
      const m: Record<string, number> = {};
      for (const [productId, q] of Object.entries(map)) {
        if (typeof productId !== 'string' || typeof q !== 'number' || !Number.isFinite(q)) continue;
        const n = Math.floor(q);
        if (n > 0) m[productId] = Math.min(n, MAX_QTY);
      }
      if (Object.keys(m).length > 0) byStudioId[studioId] = m;
    }
    return { v: 2, byStudioId };
  }
  return { v: 2, byStudioId: {} };
}

async function loadState(): Promise<ProductFavoritesStateV2> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { v: 2, byStudioId: {} };
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed != null &&
      typeof parsed === 'object' &&
      (parsed as { v?: unknown }).v === 2
    ) {
      return normalizeV2(parsed);
    }
    if (
      parsed != null &&
      typeof parsed === 'object' &&
      (parsed as { v?: unknown }).v === 1
    ) {
      const v2 = migrateV1ToV2(normalizeV1(parsed));
      await saveState(v2);
      return v2;
    }
    return { v: 2, byStudioId: {} };
  } catch {
    return { v: 2, byStudioId: {} };
  }
}

async function saveState(state: ProductFavoritesStateV2): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

function pruneStudioMap(state: ProductFavoritesStateV2, studioId: string, map: Record<string, number>): void {
  if (Object.keys(map).length === 0) delete state.byStudioId[studioId];
  else state.byStudioId[studioId] = map;
}

export type FavoriteLine = { productId: string; quantity: number };

export async function loadFavoriteEntries(studioId: string): Promise<FavoriteLine[]> {
  const state = await loadState();
  const map = state.byStudioId[studioId];
  if (!map) return [];
  return Object.keys(map).map((productId) => ({ productId, quantity: map[productId] }));
}

export async function loadFavoriteProductIds(studioId: string): Promise<string[]> {
  const entries = await loadFavoriteEntries(studioId);
  return entries.map((e) => e.productId);
}

export async function getFavoriteTotalUnits(studioId: string): Promise<number> {
  const entries = await loadFavoriteEntries(studioId);
  return entries.reduce((s, e) => s + e.quantity, 0);
}

export async function getFavoriteQuantity(studioId: string, productId: string): Promise<number> {
  const state = await loadState();
  return state.byStudioId[studioId]?.[productId] ?? 0;
}

export async function isProductFavorite(studioId: string, productId: string): Promise<boolean> {
  const q = await getFavoriteQuantity(studioId, productId);
  return q > 0;
}

export async function setProductFavorite(studioId: string, productId: string, favorite: boolean): Promise<FavoriteLine[]> {
  const state = await loadState();
  const map = { ...(state.byStudioId[studioId] ?? {}) };
  if (favorite) {
    if (map[productId] == null) map[productId] = 1;
  } else {
    delete map[productId];
  }
  pruneStudioMap(state, studioId, map);
  await saveState(state);
  return loadFavoriteEntries(studioId);
}

export async function setFavoriteQuantity(studioId: string, productId: string, quantity: number): Promise<FavoriteLine[]> {
  const state = await loadState();
  const map = { ...(state.byStudioId[studioId] ?? {}) };
  const n = Math.floor(quantity);
  if (!Number.isFinite(n) || n <= 0) {
    delete map[productId];
  } else {
    map[productId] = Math.min(n, MAX_QTY);
  }
  pruneStudioMap(state, studioId, map);
  await saveState(state);
  return loadFavoriteEntries(studioId);
}

export async function addFavoriteUnits(studioId: string, productId: string, delta: number): Promise<FavoriteLine[]> {
  const state = await loadState();
  const map = { ...(state.byStudioId[studioId] ?? {}) };
  const current = map[productId] ?? 0;
  const next = current + delta;
  if (next <= 0) {
    delete map[productId];
  } else {
    map[productId] = Math.min(next, MAX_QTY);
  }
  pruneStudioMap(state, studioId, map);
  await saveState(state);
  return loadFavoriteEntries(studioId);
}

export async function clearProductFavoritesForStudio(studioId: string): Promise<void> {
  const state = await loadState();
  delete state.byStudioId[studioId];
  await saveState(state);
}
