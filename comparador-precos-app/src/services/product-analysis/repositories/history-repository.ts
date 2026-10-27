import { apiClient } from "@/services/api/http-client";
import type {
  BackendSourceType,
  HistoryItemApiResponse,
  HistoryListApiResponse,
} from "@/services/product-analysis/repositories/types";

type ListHistoryParams = {
  limit?: number;
  offset?: number;
  sourceType?: BackendSourceType;
};

export async function listHistory({
  limit = 8,
  offset = 0,
  sourceType,
}: ListHistoryParams = {}): Promise<HistoryItemApiResponse[]> {
  const { data } = await apiClient.get<HistoryListApiResponse>("/history", {
    params: {
      limit,
      offset,
      source_type: sourceType,
    },
  });

  return data.items;
}

export async function getHistoryItem(
  historyId: string,
): Promise<HistoryItemApiResponse> {
  const { data } = await apiClient.get<HistoryItemApiResponse>(
    `/history/${encodeURIComponent(historyId)}`,
  );

  return data;
}
