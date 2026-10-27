import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HomeHistorySection } from "@/components/home";
import type { HomeHistoryItem } from "@/components/home";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  activateHistoryItemById,
  getRecentScans,
  refreshScanCollections,
} from "@/services/product-analysis/scan-result-store";

export default function HistoryScreen() {
  const [historyItems, setHistoryItems] = useState(() => getRecentScans());

  const refreshShelves = useCallback(async () => {
    try {
      await refreshScanCollections();
    } catch (error) {
      console.log("Nao foi possivel sincronizar historico remoto:", { error });
    }

    setHistoryItems(getRecentScans());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshShelves();
    }, [refreshShelves]),
  );

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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                router.back();
              }}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <ThemedText style={styles.backButtonText}>Voltar</ThemedText>
            </TouchableOpacity>

            <View style={styles.headerCopy}>
              <ThemedText style={styles.title}>Histórico completo</ThemedText>
              <ThemedText style={styles.subtitle}>
                Revise todas as suas buscas e escaneamentos recentes.
              </ThemedText>
            </View>
          </View>

          <HomeHistorySection
            historyItems={historyItems}
            onOpenItem={handleOpenStoredResult}
            onFavoriteChange={refreshShelves}
            showHeader={false}
          />
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
  header: {
    gap: 12,
    backgroundColor: "transparent",
  },
  backButton: {
    alignSelf: "flex-start",
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
  headerCopy: {
    gap: 4,
    backgroundColor: "transparent",
  },
  title: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
});
