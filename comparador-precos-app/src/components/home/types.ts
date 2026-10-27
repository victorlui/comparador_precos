import type { ScanHistoryItem } from "@/services/product-analysis/scan-result-store";

export type HomeHistoryItem = ScanHistoryItem & {
  isFavorite: boolean;
};
