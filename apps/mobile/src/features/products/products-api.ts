import { apiFetchJsonAuth } from '@/shared/api/authenticated-fetch';

export type StudioProductDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  category: string;
  imageUrls: string[];
  priceMinor: number;
  currency: string;
  isAvailable: boolean;
  stock: number | null;
};

export async function fetchStudioProducts(studioId: string): Promise<StudioProductDto[]> {
  return apiFetchJsonAuth<StudioProductDto[]>(`/studios/${studioId}/products`);
}
