import { Image } from "expo-image";
import { useState } from "react";
import {
  Alert,
  GestureResponderEvent,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

import type { HomeHistoryItem } from "@/components/home/types";
import { ThemedText } from "@/components/themed-text";
import { AppOfferRow } from "@/components/ui/app-offer-row";
import { AppPill } from "@/components/ui/app-pill";
import { toggleFavoriteProduct } from "@/services/product-analysis/scan-result-store";

const favoriteIcon = require("../../../assets/icons/favorite.svg");
const favoriteIconActive = require("../../../assets/icons/favorite-com.svg");
const chevronBottomIcon = require("../../../assets/icons/chevron-bottom.svg");
const chevronTopIcon = require("../../../assets/icons/chevron-top.svg");

type HomeHistorySectionProps = {
  historyItems: HomeHistoryItem[];
  onOpenItem: (item: HomeHistoryItem) => Promise<void> | void;
  onFavoriteChange: () => Promise<void> | void;
  onViewAll?: () => void;
  showHeader?: boolean;
};

function HistoryThumbnail({ image }: { image?: string }) {
  if (image) {
    return (
      <Image
        source={image}
        style={styles.historyThumb}
        contentFit="cover"
        transition={100}
      />
    );
  }

  return (
    <View style={styles.historyThumbFallback}>
      <ThemedText style={styles.historyThumbFallbackText}>IMG</ThemedText>
    </View>
  );
}

function DetailsToggleButton({
  isExpanded,
  onPress,
}: {
  isExpanded: boolean;
  onPress: (event: GestureResponderEvent) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.detailsToggleButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        isExpanded ? "Recolher menos detalhes" : "Expandir mais detalhes"
      }
    >
      <Image
        source={isExpanded ? chevronTopIcon : chevronBottomIcon}
        style={styles.detailsToggleIcon}
        contentFit="contain"
      />
    </TouchableOpacity>
  );
}

function HistoryInlineFavorite({
  isFavorite,
  onPress,
}: {
  isFavorite: boolean;
  onPress: (event: GestureResponderEvent) => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.historyInlineFavorite,
        isFavorite && styles.historyInlineFavoriteActive,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"
      }
    >
      <Image
        source={isFavorite ? favoriteIconActive : favoriteIcon}
        style={[
          styles.historyInlineFavoriteIcon,
          isFavorite && styles.historyInlineFavoriteIconActive,
        ]}
        contentFit="contain"
      />
      <ThemedText
        style={[
          styles.historyInlineFavoriteText,
          isFavorite && styles.historyInlineFavoriteTextActive,
        ]}
      >
        {isFavorite ? "Favorito" : "Favoritar"}
      </ThemedText>
    </TouchableOpacity>
  );
}

function HistoryItemCard({
  item,
  onOpenItem,
  onToggleFavorite,
}: {
  item: HomeHistoryItem;
  onOpenItem: (item: HomeHistoryItem) => Promise<void> | void;
  onToggleFavorite: (
    item: HomeHistoryItem,
  ) => (event: GestureResponderEvent) => void;
}) {
  const previewOffers = item.result.precos?.slice(0, 3) || [];
  const hasPreview = previewOffers.length > 0;
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleDetails = (event: GestureResponderEvent) => {
    event.stopPropagation();
    setIsExpanded((current) => !current);
  };

  return (
    <TouchableOpacity
      style={styles.historyCard}
      onPress={() => {
        void onOpenItem(item);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Abrir comparação de ${item.productName}`}
    >
      <View style={styles.historyCardHeader}>
        <HistoryThumbnail image={item.image} />

        <View style={styles.historyBody}>
          <View style={styles.historyTopRow}>
            <View style={styles.historyTitleContainer}>
              <ThemedText
                style={styles.historyTitle}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {item.productName}
              </ThemedText>
              <ThemedText style={styles.historySourceBadgeText}>
                {item.source === "camera" ? "Foto" : "Manual"}
              </ThemedText>
            </View>

            <View style={styles.historyInlineActions}>
              <HistoryInlineFavorite
                isFavorite={item.isFavorite}
                onPress={onToggleFavorite(item)}
              />
              {hasPreview ? (
                <DetailsToggleButton
                  isExpanded={isExpanded}
                  onPress={handleToggleDetails}
                />
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {isExpanded ? (
        <Animated.View
          entering={FadeInDown.duration(180)}
          exiting={FadeOutUp.duration(140)}
          style={styles.historyDetails}
        >
          <View style={styles.historyDetailsDivider} />
          {hasPreview ? (
            <View style={styles.comparisonSection}>
              <View style={styles.comparisonHeader}>
                <View style={styles.comparisonHeaderCopy}>
                  <ThemedText style={styles.comparisonEyebrow}>
                    Melhor oferta do momento
                  </ThemedText>
                  <ThemedText style={styles.comparisonTitle}>
                    Comparação rápida
                  </ThemedText>
                </View>

                <AppPill
                  label={`${previewOffers.length} ofertas`}
                  style={styles.comparisonCountBadge}
                  textStyle={styles.comparisonCountText}
                />
              </View>

              <View style={styles.comparisonBox}>
                <View style={styles.offerPreviewList}>
                  {previewOffers.map((offer, index) => (
                    <AppOfferRow
                      key={`${offer.loja}-${offer.preco}-${index}`}
                      variant="compact"
                      storeName={offer.loja || "Loja"}
                      price={offer.preco || "Sem preço"}
                      shipping={offer.frete}
                      isBest={index === 0}
                      rankIndex={index + 1}
                      highlightLabel={index === 0 ? "Melhor agora" : undefined}
                    />
                  ))}
                </View>
              </View>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </TouchableOpacity>
  );
}

export function HomeHistorySection({
  historyItems,
  onOpenItem,
  onFavoriteChange,
  onViewAll,
  showHeader = true,
}: HomeHistorySectionProps) {
  const handleToggleFavorite =
    (item: HomeHistoryItem) => async (event: GestureResponderEvent) => {
      event.stopPropagation();
      try {
        await toggleFavoriteProduct({
          productName: item.productName,
          result: item.result,
          source: item.source,
        });
        onFavoriteChange();
      } catch (error) {
        Alert.alert(
          "Favoritos",
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar os favoritos.",
        );
      }
    };

  return (
    <View style={styles.sectionBlock}>
      {showHeader ? (
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              Histórico Recente
            </ThemedText>
            <ThemedText style={styles.sectionMeta}>
              Últimas ofertas encontradas
            </ThemedText>
          </View>

          {historyItems.length > 0 && onViewAll ? (
            <TouchableOpacity
              style={styles.sectionActionButton}
              onPress={onViewAll}
              accessibilityRole="button"
              accessibilityLabel="Abrir histórico completo"
            >
              <ThemedText style={styles.sectionActionText}>
                Ver Todos
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {historyItems.length > 0 ? (
        <View style={styles.historyList}>
          {historyItems.map((item) => (
            <HistoryItemCard
              key={item.id}
              item={item}
              onOpenItem={onOpenItem}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <ThemedText style={styles.emptyStateTitle}>
            Nenhuma busca por aqui ainda
          </ThemedText>
          <ThemedText style={styles.emptyStateText}>
            Escaneie um produto ou faça uma busca para começar seu histórico.
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionBlock: {
    gap: 12,
    backgroundColor: "transparent",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "transparent",
  },
  sectionHeader: {
    flex: 1,
    gap: 2,
    backgroundColor: "transparent",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  sectionMeta: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  sectionActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexShrink: 0,
  },
  sectionActionText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
  },
  comparisonBox: {
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    padding: 12,
  },
  comparisonSection: {
    gap: 12,
    backgroundColor: "transparent",
  },
  comparisonHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "transparent",
  },
  comparisonHeaderCopy: {
    flex: 1,
    gap: 2,
    backgroundColor: "transparent",
  },
  comparisonEyebrow: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  comparisonTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  comparisonCountBadge: {
    borderRadius: 999,
    backgroundColor: "#EEF2F7",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  comparisonCountText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  offerPreviewList: {
    gap: 10,
    backgroundColor: "transparent",
  },
  offerHighlightBadge: {
    flexShrink: 0,
  },
  offerHighlightText: {
    fontSize: 10,
    fontWeight: "800",
  },
  historyDetails: {
    marginTop: 12,
    gap: 12,
    backgroundColor: "transparent",
  },
  historyDetailsDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  detailsToggleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  detailsToggleIcon: {
    width: 14,
    height: 14,
    tintColor: "#64748B",
  },
  historyList: {
    gap: 10,
    backgroundColor: "transparent",
  },
  historyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  historyCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "transparent",
  },
  historyThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  historyThumbFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  historyThumbFallbackText: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "800",
  },
  historyBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    backgroundColor: "transparent",
  },
  historyTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "transparent",
  },
  historyTitleContainer: {
    flex: 1,
  },
  historyTitle: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
  },
  historyMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "transparent",
  },
  historySourceBadge: {
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexShrink: 0,
  },
  historySourceBadgeText: {
    color: "#475569",
    fontSize: 9,
    fontWeight: "400",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  historyMeta: {
    flex: 1,
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
  },
  historyFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
    backgroundColor: "transparent",
  },
  historyPriceBlock: {
    gap: 1,
    backgroundColor: "transparent",
  },
  historyPriceLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  historyPrice: {
    color: "#166534",
    fontSize: 15,
    fontWeight: "900",
  },
  historyOpenButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexShrink: 0,
  },
  historyOpenHintText: {
    color: "#334155",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  historyOpenButtonIcon: {
    width: 10,
    height: 10,
    tintColor: "#64748B",
    transform: [{ rotate: "-90deg" }],
  },
  historyInlineActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "transparent",
    flexShrink: 0,
  },
  historyInlineFavorite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  historyInlineFavoriteActive: {
    borderColor: "#F5C451",
    backgroundColor: "#FFF6D6",
  },
  historyInlineFavoriteIcon: {
    width: 14,
    height: 14,
    tintColor: "#64748B",
  },
  historyInlineFavoriteIconActive: {
    tintColor: "#D97706",
  },
  historyInlineFavoriteText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  historyInlineFavoriteTextActive: {
    color: "#A16207",
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 6,
  },
  emptyStateTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyStateText: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
});
