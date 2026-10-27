import type { ScanProductResponse } from "@/services/product-analysis/types";

export type BackendSourceType = "image_scan" | "text_search";

export type HistoryOfferApiResponse = {
  id: string;
  position: number;
  loja: string;
  titulo: string;
  preco_centavos?: number | null;
  frete_centavos?: number | null;
  total_centavos?: number | null;
  link: string;
  imagem?: string | null;
};

export type HistoryItemApiResponse = {
  id: string;
  source_type: BackendSourceType;
  input_query?: string | null;
  product_name: string;
  candidates: string[];
  source_file_name?: string | null;
  source_file_path?: string | null;
  offers_count: number;
  cheapest_total_cents?: number | null;
  created_at: string;
  offers: HistoryOfferApiResponse[];
  raw_response: ScanProductResponse;
};

export type HistoryListApiResponse = {
  items: HistoryItemApiResponse[];
  limit: number;
  offset: number;
};

export type FavoriteItemApiResponse = {
  id: string;
  product_key: string;
  product_name: string;
  source_type?: BackendSourceType | null;
  best_price?: string | null;
  best_store?: string | null;
  image?: string | null;
  created_at: string;
  updated_at: string;
  result: ScanProductResponse;
};

export type FavoriteListApiResponse = {
  items: FavoriteItemApiResponse[];
  limit: number;
  offset: number;
};
