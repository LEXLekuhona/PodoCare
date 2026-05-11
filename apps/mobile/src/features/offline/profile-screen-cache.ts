import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MeProfile } from '@/features/user/me-api';

const KEY = 'srs.snapshot.profile.v1';

export type ProfileScreenSnapshotV1 = {
  v: 1;
  profile: MeProfile;
};

export async function loadProfileSnapshot(): Promise<MeProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ProfileScreenSnapshotV1;
    if (data?.v !== 1 || !data.profile || typeof data.profile.id !== 'string') return null;
    return data.profile;
  } catch {
    return null;
  }
}

export async function saveProfileSnapshot(profile: MeProfile): Promise<void> {
  const snap: ProfileScreenSnapshotV1 = { v: 1, profile };
  await AsyncStorage.setItem(KEY, JSON.stringify(snap));
}

export async function clearProfileSnapshot(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
