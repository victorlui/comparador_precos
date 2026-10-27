import { getClerkErrorMessage } from "@/components/auth/auth-utils";
import { useAuth, useClerk, useSignIn } from "@clerk/expo";
import { useSSO } from "@clerk/expo/experimental";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

WebBrowser.maybeCompleteAuthSession();

type ProviderName = "google" | "apple";

type AuthScreenProps = {
  onCreateAccount?: () => void;
};

export function AuthScreen({ onCreateAccount }: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  const redirectUrl = useMemo(() => Linking.createURL("/"), []);
  const { isLoaded } = useAuth();
  const clerk = useClerk();
  const { startSSOFlow } = useSSO();
  const { signIn, fetchStatus: signInFetchStatus } = useSignIn();
  const [socialLoading, setSocialLoading] = useState<ProviderName | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const socialButtonsDisabled =
    !isLoaded || socialLoading !== null || emailLoading;
  const formBusy = emailLoading || signInFetchStatus === "fetching";
  const formDisabled = !isLoaded || socialLoading !== null || formBusy;
  const handleSSO = async (provider: ProviderName) => {
    if (socialButtonsDisabled) {
      return;
    }

    setFormError(null);
    setSocialLoading(provider);

    try {
      const strategy = provider === "google" ? "oauth_google" : "oauth_apple";
      const { createdSessionId } = await startSSOFlow({
        strategy,
        redirectUrl,
      });

      if (!createdSessionId) {
        setFormError(
          "Nao foi possivel finalizar o login com esse provedor. Tente novamente em instantes.",
        );
        return;
      }

      await clerk.setActive({ session: createdSessionId });
    } catch (error) {
      setFormError(getClerkErrorMessage(error));
    } finally {
      setSocialLoading(null);
    }
  };

  const handleEmailPasswordAuth = async () => {
    console.log("handleEmailPasswordAuth", email, password);
    if (formDisabled) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setFormError("Preencha seu e-mail e sua senha para continuar.");
      return;
    }

    setFormError(null);
    setEmailLoading(true);

    try {
      const result = await signIn.create({
        identifier: normalizedEmail,
        password,
      });

      console.log("signIn.create", result.error);

      if (result.error) {
        setFormError(getClerkErrorMessage(result.error));
        return;
      }

      if (signIn.status === "complete" && signIn.createdSessionId) {
        await clerk.setActive({ session: signIn.createdSessionId });
        return;
      }

      setFormError(
        "Sua conta precisa concluir uma etapa extra no Clerk antes de entrar.",
      );
    } catch (error) {
      console.log("Error email", error);
      setFormError(getClerkErrorMessage(error));
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />

      <KeyboardAwareScrollView
        bottomOffset={10}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + 54,
              paddingBottom: Math.max(insets.bottom, 24) + 24,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Entre na sua conta</Text>
            <Text style={styles.subtitle}>
              Continue comparando, acompanhe seu historico e retome seus
              favoritos.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.socialRow}>
              {Platform.OS === "android" && (
                <Pressable
                  accessibilityRole="button"
                  disabled={socialButtonsDisabled}
                  onPress={() => {
                    void handleSSO("google");
                  }}
                  style={({ pressed }) => [
                    styles.socialButton,
                    (pressed || socialLoading === "google") &&
                      styles.buttonPressed,
                    socialButtonsDisabled && styles.buttonDisabled,
                  ]}
                >
                  <View style={styles.buttonInner}>
                    {socialLoading === "google" ? (
                      <ActivityIndicator size="small" color="#111111" />
                    ) : (
                      <Image
                        contentFit="contain"
                        source={require("../../../assets/images/google.png")}
                        style={styles.socialIcon}
                      />
                    )}
                    <Text style={styles.socialButtonText}>Google</Text>
                  </View>
                </Pressable>
              )}

              {Platform.OS === "ios" && (
                <Pressable
                  accessibilityRole="button"
                  disabled={socialButtonsDisabled}
                  onPress={() => {
                    void handleSSO("apple");
                  }}
                  style={({ pressed }) => [
                    styles.socialButton,
                    (pressed || socialLoading === "apple") &&
                      styles.buttonPressed,
                    socialButtonsDisabled && styles.buttonDisabled,
                  ]}
                >
                  <View style={styles.buttonInner}>
                    {socialLoading === "apple" ? (
                      <ActivityIndicator size="small" color="#111111" />
                    ) : (
                      <Image
                        contentFit="contain"
                        source={require("../../../assets/images/apple.png")}
                        style={styles.socialIcon}
                      />
                    )}
                    <Text style={styles.socialButtonText}>Apple</Text>
                  </View>
                </Pressable>
              )}
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.secondaryActions}>
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>E-mail</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    editable={!formBusy && !formDisabled}
                    keyboardType="email-address"
                    onChangeText={setEmail}
                    placeholder="voce@exemplo.com"
                    placeholderTextColor="#9A9A9A"
                    style={styles.input}
                    value={email}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Senha</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="current-password"
                    editable={!formBusy && !formDisabled}
                    onChangeText={setPassword}
                    placeholder="Digite sua senha"
                    placeholderTextColor="#9A9A9A"
                    secureTextEntry
                    style={styles.input}
                    value={password}
                  />
                </View>

                {formError ? (
                  <Text style={styles.formError}>{formError}</Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={formDisabled}
                  onPress={() => {
                    void handleEmailPasswordAuth();
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (pressed || formBusy) && styles.buttonPressed,
                    formDisabled && styles.buttonDisabled,
                  ]}
                >
                  <View style={styles.buttonInner}>
                    {formBusy ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : null}
                    <Text style={styles.primaryButtonText}>Entrar</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Ainda nao tem conta?</Text>
            <Pressable
              accessibilityRole="button"
              disabled={!onCreateAccount}
              onPress={onCreateAccount}
              style={({ pressed }) => [
                styles.footerButton,
                pressed && styles.buttonPressed,
                !onCreateAccount && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.footerButtonText}>Criar conta</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F3F3F3",
  },
  backgroundOrbTop: {
    position: "absolute",
    top: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(32, 138, 239, 0.12)",
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: -140,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(5, 62, 56, 0.08)",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    gap: 22,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  header: {
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#171717",
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    maxWidth: 300,
    color: "#6B6B6B",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
  },
  card: {
    gap: 18,
  },
  socialRow: {
    flexDirection: "row",
    gap: 12,
  },
  socialButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  socialIcon: {
    width: 18,
    height: 18,
  },
  socialButtonText: {
    color: "#171717",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#DFDFDF",
  },
  dividerText: {
    color: "#8A8A8A",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },
  secondaryActions: {
    gap: 12,
  },
  secondaryButton: {
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonActive: {
    backgroundColor: "#F5F5F5",
  },
  secondaryButtonText: {
    color: "#171717",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  secondaryButtonTextActive: {
    color: "#171717",
  },
  formSection: {
    gap: 12,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: "#6C6C6C",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  input: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    color: "#171717",
    fontSize: 14,
    fontWeight: "600",
  },
  formError: {
    color: "#B91C1C",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D0D0D",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  footer: {
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    color: "#6C6C6C",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  footerButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  footerButtonText: {
    color: "#171717",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
