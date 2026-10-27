import {
  deleteFavorite,
  getFavorite,
  listFavorites,
  upsertFavorite,
} from "@/services/product-analysis/repositories/favorites-repository";
import {
  getHistoryItem,
  listHistory,
} from "@/services/product-analysis/repositories/history-repository";
import type {
  BackendSourceType,
  FavoriteItemApiResponse,
  HistoryItemApiResponse,
} from "@/services/product-analysis/repositories/types";
import type { ScanProductResponse } from "@/services/product-analysis/types";

export type ScanSource = "camera" | "manual";

export type ScanHistoryItem = {
  id: string;
  productKey: string;
  productName: string;
  source: ScanSource;
  createdAt: number;
  bestPrice?: string;
  bestStore?: string;
  image?: string;
  result: ScanProductResponse;
};

const MAX_RECENT_SCANS = 8;
const MAX_FAVORITES = 50;

let latestScanResult: ScanProductResponse | null = null;
let latestScanSource: ScanSource | null = null;
let recentScans: ScanHistoryItem[] = [];
let favoriteScans: ScanHistoryItem[] = [];
const favoriteProductKeys = new Set<string>();

function getProductName(result: ScanProductResponse) {
  return (result.produto_principal || result.produto || "Produto").trim();
}

export function getProductKey(productName: string) {
  return productName.toLowerCase().replace(/\s+/g, " ").trim();
}

function getSourceFromBackend(
  sourceType?: BackendSourceType | null,
): ScanSource {
  return sourceType === "image_scan" ? "camera" : "manual";
}

function getSourceForBackend(
  source?: ScanSource | null,
): BackendSourceType | undefined {
  if (source === "camera") {
    return "image_scan";
  }

  if (source === "manual") {
    return "text_search";
  }

  return undefined;
}

function getTimestamp(value?: string) {
  if (!value) {
    return Date.now();
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function buildScanHistoryItem({
  id,
  result,
  source,
  createdAt,
  productName,
  bestPrice,
  bestStore,
  image,
}: {
  id: string;
  result: ScanProductResponse;
  source: ScanSource;
  createdAt: number;
  productName?: string;
  bestPrice?: string;
  bestStore?: string;
  image?: string;
}): ScanHistoryItem {
  const resolvedProductName = (productName || getProductName(result)).trim();
  const featuredOffer = result.precos?.[0];

  return {
    id,
    productKey: getProductKey(resolvedProductName),
    productName: resolvedProductName,
    source,
    createdAt,
    bestPrice: bestPrice || featuredOffer?.preco,
    bestStore: bestStore || featuredOffer?.loja,
    image: image || featuredOffer?.imagem,
    result,
  };
}

function mapHistoryItem(item: HistoryItemApiResponse): ScanHistoryItem {
  return buildScanHistoryItem({
    id: item.id,
    result: item.raw_response,
    source: getSourceFromBackend(item.source_type),
    createdAt: getTimestamp(item.created_at),
    productName: item.product_name,
  });
}

function mapFavoriteItem(item: FavoriteItemApiResponse): ScanHistoryItem {
  return buildScanHistoryItem({
    id: item.id,
    result: item.result,
    source: getSourceFromBackend(item.source_type),
    createdAt: getTimestamp(item.updated_at || item.created_at),
    productName: item.product_name,
    bestPrice: item.best_price || undefined,
    bestStore: item.best_store || undefined,
    image: item.image || undefined,
  });
}

function findCachedScan(productKey: string) {
  return (
    recentScans.find((item) => item.productKey === productKey) ||
    favoriteScans.find((item) => item.productKey === productKey)
  );
}

function replaceFavoriteCache(items: ScanHistoryItem[]) {
  favoriteScans = items;
  favoriteProductKeys.clear();

  items.forEach((item) => {
    favoriteProductKeys.add(item.productKey);
  });
}

function addRecentScan(result: ScanProductResponse, source: ScanSource) {
  const item = buildScanHistoryItem({
    id: `${getProductKey(getProductName(result))}-${Date.now()}`,
    result,
    source,
    createdAt: Date.now(),
  });

  recentScans = [
    item,
    ...recentScans.filter((scan) => scan.productKey !== item.productKey),
  ].slice(0, MAX_RECENT_SCANS);
}

export async function refreshScanCollections() {
  const [favorites, history] = await Promise.all([
    listFavorites({ limit: MAX_FAVORITES }),
    listHistory({ limit: MAX_RECENT_SCANS }),
  ]);

  replaceFavoriteCache(favorites.map(mapFavoriteItem));
  recentScans = history.map(mapHistoryItem).slice(0, MAX_RECENT_SCANS);

  return {
    recentScans: getRecentScans(),
    favorites: getFavoriteScans(),
  };
}

export async function syncRecentScans() {
  recentScans = (await listHistory({ limit: MAX_RECENT_SCANS })).map(
    mapHistoryItem,
  );

  return getRecentScans();
}

export async function syncFavorites() {
  replaceFavoriteCache(
    (await listFavorites({ limit: MAX_FAVORITES })).map(mapFavoriteItem),
  );

  return getFavoriteScans();
}

export function setLatestScanResult(
  result: ScanProductResponse,
  source: ScanSource = "camera",
) {
  latestScanResult = result;
  latestScanSource = source;
  addRecentScan(result, source);
}

export function setActiveScanResult(
  result: ScanProductResponse,
  source?: ScanSource,
) {
  latestScanResult = result;
  latestScanSource =
    source ||
    findCachedScan(getProductKey(getProductName(result)))?.source ||
    null;
}

export async function activateHistoryItemById(
  historyId: string,
  fallbackItem?: ScanHistoryItem,
) {
  try {
    const historyItem = mapHistoryItem(await getHistoryItem(historyId));
    setActiveScanResult(historyItem.result, historyItem.source);
    return historyItem;
  } catch (error) {
    if (fallbackItem) {
      setActiveScanResult(fallbackItem.result, fallbackItem.source);
      return fallbackItem;
    }

    throw error;
  }
}

export async function activateFavoriteProductByKey(
  productKey: string,
  fallbackItem?: ScanHistoryItem,
) {
  try {
    const favoriteItem = mapFavoriteItem(await getFavorite(productKey));
    setActiveScanResult(favoriteItem.result, favoriteItem.source);
    return favoriteItem;
  } catch (error) {
    if (fallbackItem) {
      setActiveScanResult(fallbackItem.result, fallbackItem.source);
      return fallbackItem;
    }

    throw error;
  }
}

export function getLatestScanResult() {
  return latestScanResult;
}

export function getLatestScanSource() {
  return latestScanSource;
}

export function clearLatestScanResult() {
  latestScanResult = null;
  latestScanSource = null;
}

export function getRecentScans() {
  return recentScans.map((item) => ({
    ...item,
    isFavorite: favoriteProductKeys.has(item.productKey),
  }));
}

export function getFavoriteScans() {
  return favoriteScans.map((item) => ({
    ...item,
    isFavorite: true,
  }));
}

export function isFavoriteProduct(productName: string) {
  return favoriteProductKeys.has(getProductKey(productName));
}

type ToggleFavoriteProductInput =
  | string
  | {
      productName?: string;
      result?: ScanProductResponse;
      source?: ScanSource;
    };

function resolveToggleFavoriteInput(input: ToggleFavoriteProductInput) {
  if (typeof input === "string") {
    const normalizedName = input.trim();
    const productKey = getProductKey(normalizedName);
    const cachedItem = findCachedScan(productKey);
    const latestMatches =
      latestScanResult &&
      getProductKey(getProductName(latestScanResult)) === productKey
        ? latestScanResult
        : null;

    return {
      productKey,
      productName: cachedItem?.productName || normalizedName,
      result: latestMatches || cachedItem?.result || null,
      source: latestMatches
        ? latestScanSource || cachedItem?.source
        : cachedItem?.source,
    };
  }

  const productName = (input.productName || getProductName(input.result || {}))
    .trim()
    .replace(/\s+/g, " ");
  const productKey = getProductKey(productName);
  const cachedItem = findCachedScan(productKey);

  return {
    productKey,
    productName: cachedItem?.productName || productName,
    result: input.result || cachedItem?.result || null,
    source: input.source || cachedItem?.source || latestScanSource,
  };
}

export async function toggleFavoriteProduct(input: ToggleFavoriteProductInput) {
  const { productKey, productName, result, source } =
    resolveToggleFavoriteInput(input);

  if (favoriteProductKeys.has(productKey)) {
    await deleteFavorite(productKey);
    favoriteProductKeys.delete(productKey);
    favoriteScans = favoriteScans.filter(
      (item) => item.productKey !== productKey,
    );
    return false;
  }

  if (!result) {
    throw new Error("Nao foi possivel favoritar esse produto agora.");
  }

  const savedFavorite = await upsertFavorite({
    result,
    productName,
    sourceType: getSourceForBackend(source),
  });
  const favoriteItem = mapFavoriteItem(savedFavorite);

  favoriteProductKeys.add(favoriteItem.productKey);
  favoriteScans = [
    favoriteItem,
    ...favoriteScans.filter(
      (item) => item.productKey !== favoriteItem.productKey,
    ),
  ];

  return true;
}
