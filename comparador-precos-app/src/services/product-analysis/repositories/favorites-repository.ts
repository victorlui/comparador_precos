import { apiClient } from "@/services/api/http-client";
import type { ScanProductResponse } from "@/services/product-analysis/types";
import type {
  BackendSourceType,
  FavoriteItemApiResponse,
  FavoriteListApiResponse,
} from "@/services/product-analysis/repositories/types";

type ListFavoritesParams = {
  limit?: number;
  offset?: number;
};

type UpsertFavoriteParams = {
  result: ScanProductResponse;
  productName?: string;
  sourceType?: BackendSourceType;
};

export async function listFavorites({
  limit = 20,
  offset = 0,
}: ListFavoritesParams = {}): Promise<FavoriteItemApiResponse[]> {
  const { data } = await apiClient.get<FavoriteListApiResponse>("/favorites", {
    params: {
      limit,
      offset,
    },
  });

  return data.items;
}

export async function getFavorite(
  productKey: string,
): Promise<FavoriteItemApiResponse> {
  const { data } = await apiClient.get<FavoriteItemApiResponse>(
    `/favorites/${encodeURIComponent(productKey)}`,
  );

  return data;
}

export async function upsertFavorite({
  result,
  productName,
  sourceType,
}: UpsertFavoriteParams): Promise<FavoriteItemApiResponse> {
  const { data } = await apiClient.put<FavoriteItemApiResponse>("/favorites", {
    result,
    product_name: productName,
    source_type: sourceType,
  });

  return data;
}

export async function deleteFavorite(productKey: string): Promise<void> {
  await apiClient.delete(`/favorites/${encodeURIComponent(productKey)}`);
}
