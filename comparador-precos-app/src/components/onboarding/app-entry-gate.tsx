import { AuthScreen } from "@/components/auth/auth-screen";
import { acceptCurrentLegalDocumentsIfNeeded } from "@/components/auth/auth-utils";
import { SignUpScreen } from "@/components/auth/sign-up-screen";
import WelcomeScreen from "@/components/onboarding/welcome-screen";
import { Show, useAuth } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const ONBOARDING_COMPLETED_KEY = "comparador-precos_onboarding_completed_v6";

type AppEntryGateProps = {
  children: React.ReactNode;
};

function SignedIn({ children }: { children: React.ReactNode }) {
  return <Show when="signed-in">{children}</Show>;
}

function SignedOut({ children }: { children: React.ReactNode }) {
  return <Show when="signed-out">{children}</Show>;
}

function LegalConsentBootstrap() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !userId) {
      syncedUserIdRef.current = null;
      return;
    }

    if (syncedUserIdRef.current === userId) {
      return;
    }

    let isCancelled = false;

    const syncConsent = async () => {
      try {
        await acceptCurrentLegalDocumentsIfNeeded({
          getToken,
        });

        if (!isCancelled) {
          syncedUserIdRef.current = userId;
        }
      } catch (error) {
        console.log("Nao foi possivel sincronizar o consentimento legal:", {
          error,
          userId,
        });
      }
    };

    void syncConsent();

    return () => {
      isCancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, userId]);

  return null;
}

export function AppEntryGate({ children }: AppEntryGateProps) {
  const { isLoaded } = useAuth();
  const [state, setState] = useState<"loading" | "welcome" | "ready">(
    "loading",
  );
  const [authView, setAuthView] = useState<"signIn" | "signUp">("signIn");

  useEffect(() => {
    let isMounted = true;

    const loadOnboardingState = async () => {
      try {
        const storedValue = await SecureStore.getItemAsync(
          ONBOARDING_COMPLETED_KEY,
        );

        if (!isMounted) {
          return;
        }

        setState(storedValue === "true" ? "ready" : "welcome");
      } catch (error) {
        console.log("Nao foi possivel ler o estado do onboarding:", { error });

        if (isMounted) {
          setState("welcome");
        }
      }
    };

    void loadOnboardingState();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleComplete = async () => {
    try {
      await SecureStore.setItemAsync(ONBOARDING_COMPLETED_KEY, "true");
    } catch (error) {
      console.log("Nao foi possivel persistir o onboarding:", { error });
    } finally {
      setState("ready");
    }
  };

  if (state === "loading") {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator size="small" color="#0473D9" />
        <Text style={styles.loadingText}>
          Preparando sua primeira visita...
        </Text>
      </View>
    );
  }

  if (!isLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator size="small" color="#0473D9" />
        <Text style={styles.loadingText}>Carregando sua conta...</Text>
      </View>
    );
  }

  return (
    <>
      <SignedOut>
        {state === "welcome" ? (
          <WelcomeScreen onComplete={handleComplete} />
        ) : authView === "signUp" ? (
          <SignUpScreen
            onBack={() => {
              setAuthView("signIn");
            }}
          />
        ) : (
          <AuthScreen
            onCreateAccount={() => {
              setAuthView("signUp");
            }}
          />
        )}
      </SignedOut>

      <SignedIn>
        <LegalConsentBootstrap />
        {children}
      </SignedIn>
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: "#F7FAFC",
  },
  loadingText: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
});
