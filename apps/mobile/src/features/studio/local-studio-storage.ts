import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'podocare.selectedStudio.v1';

export type SelectedStudio = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
};

export async function loadSelectedStudio(): Promise<SelectedStudio | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SelectedStudio;
    if (!parsed?.id || !parsed?.address) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSelectedStudio(studio: SelectedStudio): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(studio));
}

export async function clearSelectedStudio(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
