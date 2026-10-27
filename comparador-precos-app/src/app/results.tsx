import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AppOfferRow } from "@/components/ui/app-offer-row";
import { AppPill } from "@/components/ui/app-pill";
import {
  clearLatestScanResult,
  getLatestScanResult,
  getLatestScanSource,
  isFavoriteProduct,
  syncFavorites,
  toggleFavoriteProduct,
} from "@/services/product-analysis/scan-result-store";

type PriceItem = {
  loja?: string;
  titulo?: string;
  preco?: string;
  link?: string;
  frete?: string;
  imagem?: string;
};

export default function ResultsScreen() {
  const result = useMemo(() => getLatestScanResult(), []);
  const fallbackProductName =
    result?.produto_principal || result?.produto || "";
  const [isFavorite, setIsFavorite] = useState(
    fallbackProductName ? isFavoriteProduct(fallbackProductName) : false,
  );

  useEffect(() => {
    if (!result) {
      router.replace("/");
    }
  }, [result]);

  useEffect(() => {
    if (!fallbackProductName) {
      return;
    }

    void syncFavorites()
      .then(() => {
        setIsFavorite(isFavoriteProduct(fallbackProductName));
      })
      .catch(() => {
        setIsFavorite(isFavoriteProduct(fallbackProductName));
      });
  }, [fallbackProductName]);

  if (!result) {
    return null;
  }

  const productName = result.produto_principal || result.produto || "Produto";
  const prices = (result.precos || []) as PriceItem[];
  const featuredOffer = prices[0];
  const recognizedItems = [productName, ...(result.candidatos || [])].filter(
    (candidate, index, array) =>
      candidate && array.indexOf(candidate) === index,
  );

  const handleBack = () => {
    clearLatestScanResult();
    router.replace("/");
  };

  const handleToggleFavorite = async () => {
    try {
      const nextState = await toggleFavoriteProduct({
        productName,
        result,
        source: getLatestScanSource() || undefined,
      });
      setIsFavorite(nextState);
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
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(420)}>
            <ThemedView style={styles.topBar}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
              >
                <ThemedText style={styles.backButtonText}>Voltar</ThemedText>
              </TouchableOpacity>

              <ThemedView style={styles.topBarRight}>
                <TouchableOpacity
                  style={[
                    styles.favoriteButton,
                    isFavorite && styles.favoriteButtonActive,
                  ]}
                  onPress={() => {
                    void handleToggleFavorite();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isFavorite
                      ? "Remover dos favoritos"
                      : "Adicionar aos favoritos"
                  }
                >
                  <ThemedText
                    style={[
                      styles.favoriteButtonText,
                      isFavorite && styles.favoriteButtonTextActive,
                    ]}
                  >
                    {isFavorite ? "Favorito" : "Favoritar"}
                  </ThemedText>
                </TouchableOpacity>

                <AppPill
                  label={`${prices.length} ofertas`}
                  size="md"
                  style={styles.topBadge}
                  textStyle={styles.topBadgeText}
                />
              </ThemedView>
            </ThemedView>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(50).duration(460)}>
            <ThemedView style={styles.summarySection}>
              <ThemedView style={styles.summaryHeader}>
                <ThemedView style={styles.summaryCopy}>
                  <ThemedText style={styles.summaryEyebrow}>
                    Resultado da busca
                  </ThemedText>
                  <ThemedText style={styles.summaryText}>
                    Produto identificado com ofertas organizadas por menor
                    valor.
                  </ThemedText>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.hero}>
                <ThemedView style={styles.heroMedia}>
                  {featuredOffer?.imagem ? (
                    <Image
                      source={featuredOffer.imagem}
                      style={styles.heroImage}
                      contentFit="cover"
                      transition={180}
                    />
                  ) : (
                    <ThemedView style={styles.heroFallback}>
                      <ThemedText style={styles.heroFallbackText}>
                        Produto identificado
                      </ThemedText>
                    </ThemedView>
                  )}

                  <ThemedView style={styles.heroShade} />

                  {featuredOffer?.preco ? (
                    <ThemedView style={styles.bestPriceBadge}>
                      <ThemedText style={styles.bestPriceLabel}>
                        Melhor preço
                      </ThemedText>
                      <ThemedText style={styles.bestPriceValue}>
                        {featuredOffer.preco}
                      </ThemedText>
                    </ThemedView>
                  ) : null}

                  <ThemedView style={styles.heroInfo}>
                    <ThemedText style={styles.heroEyebrow}>
                      Produto principal identificado
                    </ThemedText>
                    <ThemedText style={styles.heroTitle}>
                      {productName}
                    </ThemedText>
                    <ThemedText style={styles.heroDescription}>
                      Compare rapidamente as ofertas mais competitivas para esse
                      item.
                    </ThemedText>
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.heroDetailsRow}>
                  <ThemedView style={styles.heroDetailItem}>
                    <ThemedText style={styles.heroDetailLabel}>
                      Melhor loja
                    </ThemedText>
                    <ThemedText
                      style={styles.heroDetailValue}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {featuredOffer?.loja || "Não identificado"}
                    </ThemedText>
                  </ThemedView>

                  <ThemedView style={styles.heroDetailDivider} />

                  <ThemedView style={styles.heroDetailItem}>
                    <ThemedText style={styles.heroDetailLabel}>
                      Frete
                    </ThemedText>
                    <ThemedText
                      style={styles.heroDetailValue}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {featuredOffer?.frete || "Consultar loja"}
                    </ThemedText>
                  </ThemedView>

                  <ThemedView style={styles.heroDetailDivider} />

                  <ThemedView style={styles.heroDetailItem}>
                    <ThemedText style={styles.heroDetailLabel}>
                      Ofertas
                    </ThemedText>
                    <ThemedText style={styles.heroDetailValue}>
                      {prices.length}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          </Animated.View>

          {recognizedItems.length > 0 ? (
            <Animated.View entering={FadeInUp.delay(100).duration(420)}>
              <ThemedView style={styles.section}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>
                    Produtos identificados
                  </ThemedText>
                  <ThemedText style={styles.sectionSubtitle}>
                    Sugestões próximas ao item principal.
                  </ThemedText>
                </ThemedView>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recognizedList}
                >
                  {recognizedItems.map((item, index) => (
                    <ThemedView
                      key={`${item}-${index}`}
                      style={[
                        styles.recognizedPill,
                        index === 0 && styles.recognizedPillActive,
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.recognizedPillText,
                          index === 0 && styles.recognizedPillTextActive,
                        ]}
                      >
                        {index === 0 ? `Principal: ${item}` : item}
                      </ThemedText>
                    </ThemedView>
                  ))}
                </ScrollView>
              </ThemedView>
            </Animated.View>
          ) : null}

          <ThemedView style={styles.offersSection}>
            <Animated.View entering={FadeInUp.delay(140).duration(420)}>
              <ThemedView style={styles.offersHeader}>
                <ThemedView style={styles.offersHeaderCopy}>
                  <ThemedText style={styles.offersTitle}>
                    Ofertas encontradas
                  </ThemedText>
                  <ThemedText style={styles.offersSubtitle}>
                    Ordenadas do menor valor para o maior.
                  </ThemedText>
                </ThemedView>
                <AppPill
                  label={`${prices.length} resultados`}
                  style={styles.offersCountBadge}
                  textStyle={styles.offersCountText}
                />
              </ThemedView>
            </Animated.View>

            {prices.length > 0 ? (
              <ThemedView style={styles.offerList}>
                {prices.map((item, index) => {
                  const storeName = item.loja || "Loja";
                  const title = item.titulo || productName;
                  const price = item.preco || "Preço indisponível";
                  const shipping = item.frete;
                  const link = item.link;
                  const image = item.imagem;

                  return (
                    <Animated.View
                      key={`${storeName}-${price}-${index}`}
                      entering={FadeInUp.delay(180 + index * 60).duration(420)}
                    >
                      <AppOfferRow
                        variant="full"
                        storeName={storeName}
                        title={title}
                        price={price}
                        shipping={shipping}
                        image={image}
                        isBest={index === 0}
                        rankLabel={
                          index === 0 ? "Melhor oferta" : `#${index + 1}`
                        }
                        onActionPress={
                          link
                            ? () => {
                                void Linking.openURL(link);
                              }
                            : undefined
                        }
                      />
                    </Animated.View>
                  );
                })}
              </ThemedView>
            ) : (
              <Animated.View entering={FadeInUp.delay(220).duration(420)}>
                <ThemedView style={styles.emptyState}>
                  <ThemedText style={styles.emptyStateTitle}>
                    Nenhuma oferta encontrada
                  </ThemedText>
                  <ThemedText style={styles.emptyStateMessage}>
                    Tente capturar outra foto com o produto mais centralizado e
                    com menos elementos ao redor.
                  </ThemedText>
                </ThemedView>
              </Animated.View>
            )}
          </ThemedView>
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#EEF2F7",
  },
  container: {
    flex: 1,
    backgroundColor: "#EEF2F7",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 18,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "transparent",
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "transparent",
  },
  backButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  backButtonText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  favoriteButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CFE1DC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  favoriteButtonActive: {
    borderColor: "#BDE4D8",
    backgroundColor: "#E9F7F2",
  },
  favoriteButtonText: {
    color: "#466B63",
    fontSize: 12,
    fontWeight: "700",
  },
  favoriteButtonTextActive: {
    color: "#0F4C45",
  },
  topBadge: {
    borderRadius: 999,
    backgroundColor: "#E8EEF5",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  topBadgeText: {
    color: "#5B6B7F",
    fontSize: 12,
    fontWeight: "700",
  },
  summarySection: {
    gap: 14,
    backgroundColor: "transparent",
  },
  summaryHeader: {
    gap: 6,
    backgroundColor: "transparent",
  },
  summaryCopy: {
    gap: 4,
    backgroundColor: "transparent",
  },
  summaryEyebrow: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
  summaryText: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  bestPriceBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.94)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
    zIndex: 2,
  },
  bestPriceLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  bestPriceValue: {
    color: "#166534",
    fontSize: 20,
    fontWeight: "800",
  },
  hero: {
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#FFFFFF",
  },
  heroMedia: {
    position: "relative",
    overflow: "hidden",
    minHeight: 320,
    backgroundColor: "#E2E8F0",
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#E2E8F0",
  },
  heroFallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.24)",
  },
  heroFallbackText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  heroInfo: {
    marginTop: "auto",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 88,
    paddingBottom: 20,
    backgroundColor: "transparent",
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 31,
    lineHeight: 35,
    fontWeight: "800",
  },
  heroDescription: {
    maxWidth: 280,
    color: "rgba(255,255,255,0.86)",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  heroDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  heroDetailItem: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    backgroundColor: "transparent",
  },
  heroDetailLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  heroDetailValue: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
  },
  heroDetailDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "#E2E8F0",
    marginHorizontal: 12,
  },
  section: {
    gap: 10,
    backgroundColor: "transparent",
  },
  sectionHeader: {
    gap: 2,
    backgroundColor: "transparent",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  recognizedList: {
    gap: 10,
    paddingRight: 18,
  },
  recognizedPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recognizedPillActive: {
    borderColor: "#BDE4D8",
    backgroundColor: "#E9F7F2",
  },
  recognizedPillText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
  recognizedPillTextActive: {
    color: "#0F4C45",
  },
  offersSection: {
    gap: 14,
    backgroundColor: "transparent",
  },
  offersHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "transparent",
  },
  offersHeaderCopy: {
    flex: 1,
    gap: 4,
    backgroundColor: "transparent",
  },
  offersTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
  },
  offersSubtitle: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  offersCountBadge: {
    marginTop: 2,
  },
  offersCountText: {
    fontSize: 11,
  },
  offerList: {
    gap: 10,
    backgroundColor: "transparent",
  },
  emptyState: {
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#FFFFFF",
    padding: 18,
  },
  emptyStateTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyStateMessage: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
});
