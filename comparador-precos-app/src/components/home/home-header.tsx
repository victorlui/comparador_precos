import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";

export function HomeHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        {/* <View style={styles.greetingBadge}>
          <View style={styles.greetingDot} />
          <ThemedText style={styles.greeting}>
            Economia em tempo real
          </ThemedText>
        </View> */}
        <ThemedText style={styles.headerTitle}>
          Pronto para economizar?
        </ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Escaneie, compare ofertas e revisite seus produtos favoritos com
          rapidez.
        </ThemedText>
      </View>

      <View style={styles.avatarShell}>
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>VC</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    backgroundColor: "transparent",
  },
  headerCopy: {
    flex: 1,
    gap: 6,
    backgroundColor: "transparent",
  },
  greetingBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  greetingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  greeting: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
  },
  headerSubtitle: {
    maxWidth: 260,
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  avatarShell: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(37, 99, 235, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E0ECFF",
    borderWidth: 1,
    borderColor: "#C7DBFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#31527A",
    fontSize: 12,
    fontWeight: "900",
  },
});
