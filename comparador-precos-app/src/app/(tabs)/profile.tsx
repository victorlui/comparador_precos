import { useClerk, useUser } from "@clerk/expo";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function ProfileScreen() {
  const clerk = useClerk();
  const { user, isLoaded } = useUser();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const userInitials = useMemo(() => {
    const first = user?.firstName?.trim()?.[0];
    const last = user?.lastName?.trim()?.[0];
    const emailInitial = user?.primaryEmailAddress?.emailAddress?.trim()?.[0];

    return `${first ?? emailInitial ?? "V"}${last ?? ""}`.toUpperCase();
  }, [user]);

  const accountTitle = useMemo(() => {
    if (!isLoaded) {
      return "Carregando conta";
    }

    return user?.fullName?.trim() || "Conta autenticada";
  }, [isLoaded, user]);

  const accountDescription = useMemo(() => {
    if (!isLoaded) {
      return "Buscando informacoes da sua sessao atual.";
    }

    return (
      user?.primaryEmailAddress?.emailAddress ||
      "Sua conta esta conectada ao Comparador."
    );
  }, [isLoaded, user]);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    try {
      setIsSigningOut(true);
      await clerk.signOut();
    } catch (error) {
      Alert.alert(
        "Nao foi possivel sair",
        "Tente novamente em instantes para encerrar sua sessao.",
      );
      console.log("Falha ao encerrar sessao:", { error });
    } finally {
      setIsSigningOut(false);
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
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>{userInitials}</ThemedText>
            </View>

            <View style={styles.headerCopy}>
              <ThemedText style={styles.title}>Perfil</ThemedText>
              <ThemedText style={styles.subtitle}>
                Gerencie sua conta e acompanhe o acesso ao app.
              </ThemedText>
            </View>
          </View>

          <View style={styles.panel}>
            <ThemedText style={styles.panelTitle}>{accountTitle}</ThemedText>
            <ThemedText style={styles.panelText}>
              {accountDescription}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              disabled={isSigningOut}
              onPress={() => {
                void handleSignOut();
              }}
              style={({ pressed }) => [
                styles.signOutButton,
                (pressed || isSigningOut) && styles.signOutButtonPressed,
              ]}
            >
              {isSigningOut ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.signOutButtonText}>
                  Sair da conta
                </ThemedText>
              )}
            </Pressable>
          </View>

          <View style={styles.panel}>
            <ThemedText style={styles.panelTitle}>Como usar melhor</ThemedText>
            <View style={styles.tipList}>
              <ThemedText style={styles.tipItem}>
                1. Use a aba Escanear para buscar preços por foto.
              </ThemedText>
              <ThemedText style={styles.tipItem}>
                2. Favorite produtos para acessar comparações mais rápido.
              </ThemedText>
              <ThemedText style={styles.tipItem}>
                3. Revise ofertas recentes direto pela Home.
              </ThemedText>
            </View>
          </View>

          <View style={styles.panel}>
            <ThemedText style={styles.panelTitle}>Versão do app</ThemedText>
            <ThemedText style={styles.panelText}>
              Comparador de Preços MVP
            </ThemedText>
          </View>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "transparent",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#D9E4F4",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#47607E",
    fontSize: 16,
    fontWeight: "800",
  },
  headerCopy: {
    flex: 1,
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
  panel: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 8,
  },
  panelTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  panelText: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  signOutButton: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
    paddingHorizontal: 16,
  },
  signOutButtonPressed: {
    opacity: 0.88,
  },
  signOutButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  tipList: {
    gap: 8,
    backgroundColor: "transparent",
  },
  tipItem: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
});
