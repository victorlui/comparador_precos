import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  GestureResponderEvent,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  activateFavoriteProductByKey,
  getFavoriteScans,
  syncFavorites,
  toggleFavoriteProduct,
} from "@/services/product-analysis/scan-result-store";

type FavoriteItem = ReturnType<typeof getFavoriteScans>[number];

function formatScanTime(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() =>
    getFavoriteScans(),
  );

  const refreshFavorites = useCallback(async () => {
    try {
      await syncFavorites();
    } catch (error) {
      console.log("Nao foi possivel sincronizar favoritos remotos:", { error });
    }

    setFavorites(getFavoriteScans());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshFavorites();
    }, [refreshFavorites]),
  );

  const handleOpenFavorite = async (item: FavoriteItem) => {
    try {
      await activateFavoriteProductByKey(item.productKey, item);
      router.push("/results");
    } catch (error) {
      Alert.alert(
        "Favoritos",
        error instanceof Error
          ? error.message
          : "Nao foi possivel abrir esse favorito agora.",
      );
    }
  };

  const handleToggleFavorite =
    (item: FavoriteItem) => async (event: GestureResponderEvent) => {
      event.stopPropagation();
      try {
        await toggleFavoriteProduct({
          productName: item.productName,
          result: item.result,
          source: item.source,
        });
        setFavorites(getFavoriteScans());
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
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <ThemedText style={styles.title}>Favoritos</ThemedText>
            <ThemedText style={styles.subtitle}>
              Acompanhe os produtos que você quer revisitar rápido.
            </ThemedText>
          </View>

          {favorites.length > 0 ? (
            <View style={styles.list}>
              {favorites.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  onPress={() => {
                    void handleOpenFavorite(item);
                  }}
                >
                  {item.image ? (
                    <Image
                      source={item.image}
                      style={styles.image}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.imageFallback}>
                      <ThemedText style={styles.imageFallbackText}>
                        ITEM
                      </ThemedText>
                    </View>
                  )}

                  <View style={styles.body}>
                    <ThemedText
                      style={styles.productName}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {item.productName}
                    </ThemedText>
                    <ThemedText
                      style={styles.meta}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.bestStore || "Sem loja destacada"}
                    </ThemedText>

                    <View style={styles.footer}>
                      <View>
                        <ThemedText style={styles.priceLabel}>
                          Melhor oferta
                        </ThemedText>
                        <ThemedText style={styles.price}>
                          {item.bestPrice || "Sem oferta"}
                        </ThemedText>
                      </View>

                      <View style={styles.actions}>
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={handleToggleFavorite(item)}
                        >
                          <ThemedText style={styles.removeButtonText}>
                            Remover
                          </ThemedText>
                        </TouchableOpacity>

                        <ThemedText style={styles.time}>
                          Hoje, {formatScanTime(item.createdAt)}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyTitle}>
                Nenhum favorito salvo
              </ThemedText>
              <ThemedText style={styles.emptyText}>
                Favorite produtos na Home ou nos resultados para eles aparecerem
                aqui.
              </ThemedText>
            </View>
          )}
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
    paddingTop: 10,
    paddingBottom: 32,
    gap: 18,
  },
  header: {
    gap: 4,
    backgroundColor: "transparent",
  },
  title: {
    color: "#0F172A",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
  },
  subtitle: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  list: {
    gap: 12,
    backgroundColor: "transparent",
  },
  card: {
    flexDirection: "row",
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#FFFFFF",
    padding: 14,
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
  },
  imageFallback: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  imageFallbackText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 8,
    backgroundColor: "transparent",
  },
  productName: {
    color: "#111827",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  meta: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "transparent",
  },
  priceLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
  price: {
    color: "#166534",
    fontSize: 16,
    fontWeight: "900",
  },
  actions: {
    alignItems: "flex-end",
    gap: 6,
    backgroundColor: "transparent",
  },
  removeButton: {
    borderRadius: 999,
    backgroundColor: "#FFF1F2",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeButtonText: {
    color: "#BE123C",
    fontSize: 12,
    fontWeight: "800",
  },
  time: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#FFFFFF",
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
});
