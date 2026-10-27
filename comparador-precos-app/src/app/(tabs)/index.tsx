import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { HomeHistoryItem } from "@/components/home";
import {
  HomeAnimatedStage,
  HomeHeader,
  HomeHeroCard,
  HomeHistorySection,
  HomeQuickSearch,
} from "@/components/home";
import { ThemedView } from "@/components/themed-view";
import {
  getScanProductErrorMessage,
  useSearchProductMutation,
} from "@/hooks/mutations/use-scan-product-mutation";
import {
  activateHistoryItemById,
  getRecentScans,
  refreshScanCollections,
  setLatestScanResult,
} from "@/services/product-analysis/scan-result-store";

export default function HomeScreen() {
  const [manualQuery, setManualQuery] = useState("");
  const [recentScans, setRecentScans] = useState(() => getRecentScans());
  const { mutateAsync: searchProductByName, isPending: isSearching } =
    useSearchProductMutation();

  const refreshShelves = useCallback(async () => {
    try {
      await refreshScanCollections();
    } catch (error) {
      console.log("Nao foi possivel sincronizar historico remoto:", { error });
    }

    setRecentScans(getRecentScans());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshShelves();
    }, [refreshShelves]),
  );

  const historyItems = recentScans.slice(0, 5);

  const handleOpenCamera = () => {
    router.push("/camera");
  };

  const handleOpenStoredResult = async (item: HomeHistoryItem) => {
    try {
      await activateHistoryItemById(item.id, item);
      router.push("/results");
    } catch (error) {
      Alert.alert(
        "Historico",
        error instanceof Error
          ? error.message
          : "Nao foi possivel abrir esse item agora.",
      );
    }
  };

  const handleManualSearch = async () => {
    const query = manualQuery.trim();

    if (!query) {
      Alert.alert("Busca rápida", "Digite o nome do produto para pesquisar.");
      return;
    }

    try {
      const response = await searchProductByName({ query });
      setLatestScanResult(response, "manual");
      setManualQuery("");
      router.push("/results");
    } catch (error) {
      Alert.alert("Erro", getScanProductErrorMessage(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <HomeAnimatedStage variant="header">
            <HomeHeader />
          </HomeAnimatedStage>

          <HomeAnimatedStage variant="hero">
            <HomeHeroCard onPress={handleOpenCamera} />
          </HomeAnimatedStage>

          <HomeAnimatedStage variant="search">
            <HomeQuickSearch
              value={manualQuery}
              onChangeText={setManualQuery}
              isSearching={isSearching}
              onSearch={() => {
                void handleManualSearch();
              }}
            />
          </HomeAnimatedStage>

          <HomeAnimatedStage variant="history">
            <HomeHistorySection
              historyItems={historyItems}
              onOpenItem={handleOpenStoredResult}
              onFavoriteChange={refreshShelves}
              onViewAll={() => {
                router.push("/history");
              }}
            />
          </HomeAnimatedStage>
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
});
