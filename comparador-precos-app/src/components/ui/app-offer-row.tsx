import { Image } from "expo-image";
import { StyleSheet, TouchableOpacity } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AppPill } from "@/components/ui/app-pill";

type CompactOfferRowProps = {
  variant: "compact";
  storeName: string;
  price: string;
  shipping?: string;
  isBest?: boolean;
  rankIndex: number;
  highlightLabel?: string;
};

type FullOfferRowProps = {
  variant: "full";
  storeName: string;
  title: string;
  price: string;
  shipping?: string;
  image?: string;
  isBest?: boolean;
  rankLabel: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

type AppOfferRowProps = CompactOfferRowProps | FullOfferRowProps;

export function AppOfferRow(props: AppOfferRowProps) {
  if (props.variant === "compact") {
    const {
      storeName,
      price,
      shipping,
      isBest = false,
      rankIndex,
      highlightLabel,
    } = props;

    return (
      <ThemedView style={[styles.compactRow, isBest && styles.compactRowBest]}>
        <ThemedView style={[styles.rankBadge, isBest && styles.rankBadgeBest]}>
          <ThemedText style={[styles.rankText, isBest && styles.rankTextBest]}>
            {rankIndex}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.compactContent}>
          <ThemedView style={styles.compactHeader}>
            <ThemedText
              style={[styles.storeName, isBest && styles.storeNameBest]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {storeName}
            </ThemedText>

            {highlightLabel ? (
              <AppPill
                label={highlightLabel}
                tone="success"
                style={styles.highlightPill}
                textStyle={styles.highlightPillText}
              />
            ) : null}
          </ThemedView>

          <ThemedText style={[styles.price, isBest && styles.priceBest]}>
            {price}
          </ThemedText>

          {shipping ? (
            <ThemedText style={styles.shipping}>{shipping}</ThemedText>
          ) : null}
        </ThemedView>
      </ThemedView>
    );
  }

  const {
    storeName,
    title,
    price,
    shipping,
    image,
    isBest = false,
    rankLabel,
    actionLabel = "Abrir oferta",
    onActionPress,
  } = props;

  return (
    <ThemedView style={[styles.fullRow, isBest && styles.fullRowBest]}>
      {image ? (
        <Image
          source={image}
          style={styles.fullImage}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <ThemedView style={styles.fullImageFallback}>
          <ThemedText style={styles.fullImageFallbackText}>
            Sem imagem
          </ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.fullBody}>
        <ThemedView style={styles.fullMetaRow}>
          <ThemedText style={styles.storeLabel}>{storeName}</ThemedText>

          <AppPill
            label={rankLabel}
            tone={isBest ? "success" : "neutral"}
            style={[styles.rankPill, isBest && styles.rankPillBest]}
            textStyle={[styles.rankPillText, isBest && styles.rankPillTextBest]}
          />
        </ThemedView>

        <ThemedText
          style={styles.fullTitle}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {title}
        </ThemedText>

        <ThemedView style={styles.fullFooter}>
          <ThemedView style={styles.priceBlock}>
            <ThemedText style={styles.fullPrice}>{price}</ThemedText>
            {shipping ? (
              <ThemedText style={styles.shipping}>{shipping}</ThemedText>
            ) : null}
          </ThemedView>

          {onActionPress ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onActionPress}
              accessibilityRole="button"
              accessibilityLabel={`Abrir oferta da loja ${storeName}`}
            >
              <ThemedText style={styles.actionButtonText}>
                {actionLabel}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  compactRowBest: {
    borderWidth: 1,
    borderColor: "#C7E7D0",
    backgroundColor: "#F2FBF5",
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rankBadgeBest: {
    backgroundColor: "#166534",
  },
  rankText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
  rankTextBest: {
    color: "#FFFFFF",
  },
  compactContent: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    backgroundColor: "transparent",
  },
  compactHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "transparent",
  },
  storeName: {
    flex: 1,
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  storeNameBest: {
    color: "#0F5132",
  },
  price: {
    color: "#166534",
    fontSize: 17,
    fontWeight: "900",
  },
  priceBest: {
    fontSize: 18,
  },
  shipping: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
  },
  highlightPill: {
    flexShrink: 0,
  },
  highlightPillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  fullRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  fullRowBest: {
    borderColor: "#CFE1DC",
    backgroundColor: "#F8FCFA",
  },
  fullImage: {
    width: 92,
    height: 92,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
  },
  fullImageFallback: {
    width: 92,
    height: 92,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  fullImageFallbackText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  fullBody: {
    flex: 1,
    minWidth: 0,
    gap: 8,
    backgroundColor: "transparent",
  },
  fullMetaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: "transparent",
  },
  storeLabel: {
    flex: 1,
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  rankPill: {},
  rankPillBest: {},
  rankPillText: {
    fontSize: 11,
  },
  rankPillTextBest: {},
  fullTitle: {
    color: "#111827",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  fullFooter: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "transparent",
  },
  priceBlock: {
    gap: 2,
    backgroundColor: "transparent",
  },
  fullPrice: {
    color: "#166534",
    fontSize: 24,
    fontWeight: "800",
  },
  actionButton: {
    borderRadius: 999,
    backgroundColor: "#053E38",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
