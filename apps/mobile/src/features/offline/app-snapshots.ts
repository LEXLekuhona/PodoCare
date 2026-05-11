import { clearHomeSnapshot } from '@/features/offline/home-screen-cache';
import { clearProductsSnapshot } from '@/features/offline/products-screen-cache';
import { clearProfileSnapshot } from '@/features/offline/profile-screen-cache';
import { clearNextAppointmentDisk } from '@/features/appointment/next-appointment-disk-store';

export async function clearOfflineAppSnapshots(): Promise<void> {
  await Promise.all([
    clearHomeSnapshot(),
    clearProductsSnapshot(),
    clearProfileSnapshot(),
    clearNextAppointmentDisk(),
  ]);
}
