import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/themed-text";

type HomeQuickSearchProps = {
  value: string;
  isSearching: boolean;
  onChangeText: (value: string) => void;
  onSearch: () => void;
};

export function HomeQuickSearch({
  value,
  isSearching,
  onChangeText,
  onSearch,
}: HomeQuickSearchProps) {
  return (
    <View style={styles.searchSection}>
      <ThemedText style={styles.sectionTitle}>Busca Rápida</ThemedText>

      <View style={styles.searchBar}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Ou digite o nome do produto..."
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />

        <TouchableOpacity
          style={[
            styles.searchButton,
            isSearching && styles.searchButtonDisabled,
          ]}
          disabled={isSearching}
          onPress={onSearch}
        >
          <ThemedText style={styles.searchButtonText}>
            {isSearching ? "Buscando..." : "Buscar"}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchSection: {
    gap: 10,
    backgroundColor: "transparent",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D2DAE6",
    backgroundColor: "#FFFFFF",
    padding: 6,
  },
  searchInput: {
    flex: 1,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "500",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchButton: {
    borderRadius: 999,
    backgroundColor: "#5A7EA5",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  searchButtonDisabled: {
    opacity: 0.65,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
