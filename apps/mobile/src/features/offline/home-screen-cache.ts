import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FaqItemDto } from '@/features/faq/faq-api';
import type { HealthConcernDto, StudioDirectionDto } from '@/features/booking/booking-api';

const KEY = 'srs.snapshot.home.v1';

export type HomeScreenSnapshotV1 = {
  v: 1;
  firstName: string;
  faq: Pick<FaqItemDto, 'id' | 'question' | 'answer'>[];
  healthConcerns: Pick<HealthConcernDto, 'id' | 'slug' | 'title'>[];
  studioDirections: Pick<StudioDirectionDto, 'id' | 'slug' | 'title' | 'iconKey'>[];
};

export async function loadHomeSnapshot(): Promise<HomeScreenSnapshotV1 | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as HomeScreenSnapshotV1;
    if (data?.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export async function saveHomeSnapshot(snapshot: HomeScreenSnapshotV1): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(snapshot));
}

export async function clearHomeSnapshot(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
