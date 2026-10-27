import { getClerkErrorMessage } from "@/components/auth/auth-utils";
import { apiClient } from "@/services/api/http-client";
import { useAuth, useClerk, useSignUp } from "@clerk/expo";
import { useSSO } from "@clerk/expo/experimental";
import RenderHTML from "@native-html/render";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

WebBrowser.maybeCompleteAuthSession();

type SignUpScreenProps = {
  onBack?: () => void;
};

type ProviderName = "google" | "apple";
type LegalDocumentType = "terms_of_use" | "privacy_policy";

type LegalDocument = {
  id: string;
  document_type: LegalDocumentType;
  version: string;
  title: string;
  html: string;
  is_active: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
};

type LegalDocumentsResponse = {
  terms_of_use: LegalDocument;
  privacy_policy: LegalDocument;
};

function getNameParts(value: string) {
  const trimmedValue = value.trim().replace(/\s+/g, " ");

  if (!trimmedValue) {
    return { firstName: undefined, lastName: undefined };
  }

  const [firstName, ...rest] = trimmedValue.split(" ");

  return {
    firstName,
    lastName: rest.length > 0 ? rest.join(" ") : undefined,
  };
}

export function SignUpScreen({ onBack }: SignUpScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const redirectUrl = useMemo(() => Linking.createURL("/"), []);
  const { isLoaded } = useAuth();
  const clerk = useClerk();
  const { startSSOFlow } = useSSO();
  const { signUp, fetchStatus } = useSignUp();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [socialLoading, setSocialLoading] = useState<ProviderName | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [legalDocuments, setLegalDocuments] =
    useState<LegalDocumentsResponse | null>(null);
  const [legalLoading, setLegalLoading] = useState(true);
  const [legalError, setLegalError] = useState<string | null>(null);
  const [visibleLegalDocument, setVisibleLegalDocument] =
    useState<LegalDocumentType | null>(null);

  const formBusy = submitting || fetchStatus === "fetching";
  const formDisabled = !isLoaded || formBusy || socialLoading !== null;
  const socialButtonsDisabled = !isLoaded || formBusy || socialLoading !== null;
  const selectedLegalDocument = visibleLegalDocument
    ? (legalDocuments?.[visibleLegalDocument] ?? null)
    : null;
  const legalContentWidth = Math.max(windowWidth - 44, 0);

  useEffect(() => {
    let isMounted = true;

    const loadLegalDocuments = async () => {
      try {
        setLegalLoading(true);
        setLegalError(null);
        const { data } =
          await apiClient.get<LegalDocumentsResponse>("/legal/documents");

        if (!isMounted) {
          return;
        }

        setLegalDocuments(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLegalError(getClerkErrorMessage(error));
      } finally {
        if (isMounted) {
          setLegalLoading(false);
        }
      }
    };

    void loadLegalDocuments();

    return () => {
      isMounted = false;
    };
  }, []);

  const validateCreatedAccount = async () => {
    try {
      await apiClient.get("/auth/me");
      return true;
    } catch (error) {
      await clerk.signOut();
      setFormError(getClerkErrorMessage(error));
      return false;
    }
  };

  const handleSSO = async (provider: ProviderName) => {
    if (socialButtonsDisabled) {
      return;
    }

    if (!acceptTerms) {
      setFormError("Aceite os termos para continuar com o cadastro.");
      return;
    }

    setFormError(null);
    setSocialLoading(provider);

    try {
      const strategy = provider === "google" ? "oauth_google" : "oauth_apple";
      const result = await startSSOFlow({
        strategy,
        redirectUrl,
      });

      if (result.signIn && !result.signIn.isTransferable) {
        await clerk.signOut();
        setFormError(
          `Ja existe uma conta com ${provider === "google" ? "Google" : "Apple"}. Entre pela tela de login.`,
        );
        return;
      }

      if (result.createdSessionId) {
        await validateCreatedAccount();
        return;
      }

      setFormError(
        "Nao foi possivel concluir o cadastro com esse provedor agora.",
      );
    } catch (error) {
      setFormError(getClerkErrorMessage(error));
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSignUp = async () => {
    if (formDisabled) {
      return;
    }

    const normalizedFullName = fullName.trim().replace(/\s+/g, " ");
    const normalizedEmail = email.trim().toLowerCase();
    const { firstName, lastName } = getNameParts(normalizedFullName);

    if (!normalizedFullName || !normalizedEmail || !password) {
      setFormError("Preencha nome, e-mail e senha para continuar.");
      return;
    }

    if (!acceptTerms) {
      setFormError("Aceite os termos para criar sua conta.");
      return;
    }

    setFormError(null);
    setSubmitting(true);

    try {
      const result = await signUp.create({
        emailAddress: normalizedEmail,
        password,
        firstName,
        lastName,
      });

      if (result.error) {
        setFormError(getClerkErrorMessage(result.error));
        return;
      }

      if (signUp.status === "complete" && signUp.createdSessionId) {
        await signUp.finalize();
        const accountIsValid = await validateCreatedAccount();
        if (accountIsValid) {
          return;
        }

        return;
      }

      setFormError(
        "Conta criada, mas ainda falta concluir a verificacao configurada no Clerk.",
      );
    } catch (error) {
      setFormError(getClerkErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />

      <KeyboardAwareScrollView
        bottomOffset={insets.bottom}
        contentContainerStyle={styles.scrollContent}
      >
        {onBack ? (
          <View
            style={[
              styles.backButtonContainer,
              {
                paddingTop: insets.top + 10,
                paddingLeft: insets.left + 18,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={onBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Image
                contentFit="contain"
                source={require("@/assets/icons/chevron-left-svgrepo-com.svg")}
                style={styles.backButtonIcon}
              />
            </Pressable>
          </View>
        ) : null}
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
            <Text style={styles.title}>Crie sua conta</Text>
            <Text style={styles.subtitle}>
              Informe nome, e-mail e senha para criar sua conta e começarar
              preços.
            </Text>
          </View>

          <View style={styles.card}>
            {/* <View style={styles.socialRow}>
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
            </View> */}

            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nome completo</Text>
                <TextInput
                  autoCapitalize="words"
                  autoComplete="name"
                  editable={!formDisabled}
                  onChangeText={setFullName}
                  placeholder="Seu nome completo"
                  placeholderTextColor="#9A9A9A"
                  style={styles.input}
                  value={fullName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>E-mail</Text>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!formDisabled}
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
                <View style={styles.passwordField}>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    editable={!formDisabled}
                    onChangeText={setPassword}
                    placeholder="Crie uma senha"
                    placeholderTextColor="#9A9A9A"
                    secureTextEntry={!showPassword}
                    style={styles.passwordInput}
                    value={password}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={formDisabled}
                    onPress={() => {
                      setShowPassword((currentValue) => !currentValue);
                    }}
                    style={({ pressed }) => [
                      styles.passwordToggle,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.passwordToggleText}>
                      {showPassword ? "Ocultar" : "Mostrar"}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View
                style={[styles.termsRow, formDisabled && styles.buttonDisabled]}
              >
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptTerms }}
                  disabled={formDisabled}
                  onPress={() => {
                    setAcceptTerms((currentValue) => !currentValue);
                  }}
                  style={({ pressed }) => [
                    styles.checkbox,
                    acceptTerms && styles.checkboxChecked,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  {acceptTerms ? <View style={styles.checkboxDot} /> : null}
                </Pressable>
                <View style={styles.termsTextContainer}>
                  <Text style={styles.termsText}>
                    Eu concordo com os{" "}
                    <Text
                      onPress={() => {
                        setVisibleLegalDocument("terms_of_use");
                      }}
                      style={styles.termsLink}
                    >
                      Termos
                    </Text>{" "}
                    e com a{" "}
                    <Text
                      onPress={() => {
                        setVisibleLegalDocument("privacy_policy");
                      }}
                      style={styles.termsLink}
                    >
                      Politica de Privacidade
                    </Text>
                    .
                  </Text>
                  {legalLoading ? (
                    <Text style={styles.termsHint}>
                      Carregando documentos...
                    </Text>
                  ) : null}
                  {legalError ? (
                    <Text style={styles.termsError}>
                      Nao foi possivel carregar os documentos agora.
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {formError ? (
              <Text style={styles.formError}>{formError}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={formDisabled}
              onPress={() => {
                void handleSignUp();
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
                <Text style={styles.primaryButtonText}>Criar conta</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Ja tem uma conta?</Text>
            <Pressable
              accessibilityRole="button"
              disabled={!onBack}
              onPress={onBack}
              style={({ pressed }) => [
                styles.footerButton,
                pressed && styles.buttonPressed,
                !onBack && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.footerButtonText}>Entrar</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => {
          setVisibleLegalDocument(null);
        }}
        visible={visibleLegalDocument !== null}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                paddingTop: Math.max(insets.top, 18),
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>
                  {selectedLegalDocument?.title ??
                    (visibleLegalDocument === "terms_of_use"
                      ? "Termos de Uso"
                      : "Politica de Privacidade")}
                </Text>
                {selectedLegalDocument?.version ? (
                  <Text style={styles.modalSubtitle}>
                    Versao {selectedLegalDocument.version}
                  </Text>
                ) : null}
              </View>

              <View style={styles.modalHeaderSpacer} />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setVisibleLegalDocument(null);
                }}
                style={({ pressed }) => [
                  styles.modalCloseButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.modalCloseButtonText}>X</Text>
              </Pressable>
            </View>
            <View style={styles.modalHeaderDivider} />

            <ScrollView
              contentContainerStyle={styles.modalBodyContent}
              showsVerticalScrollIndicator={false}
              style={styles.modalBody}
            >
              {legalLoading ? (
                <View style={styles.modalLoadingState}>
                  <ActivityIndicator color="#111111" size="small" />
                  <Text style={styles.modalLoadingText}>
                    Carregando documento...
                  </Text>
                </View>
              ) : null}

              {!legalLoading && legalError ? (
                <Text style={styles.modalErrorText}>
                  Nao foi possivel carregar este documento no momento.
                </Text>
              ) : null}

              {!legalLoading && !legalError && selectedLegalDocument?.html ? (
                <RenderHTML
                  baseStyle={styles.modalDocumentText}
                  contentWidth={legalContentWidth}
                  source={{ html: selectedLegalDocument.html }}
                  tagsStyles={htmlTagsStyles}
                />
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  backButtonContainer: {
    position: "absolute",
    zIndex: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  backButtonText: {
    color: "#111111",
    fontSize: 20,
    lineHeight: 20,
    fontWeight: "700",
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
  backButtonIcon: {
    width: 24,
    height: 24,
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
  formSection: {
    gap: 12,
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
  passwordField: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 8,
  },
  passwordInput: {
    flex: 1,
    color: "#171717",
    fontSize: 14,
    fontWeight: "600",
  },
  passwordToggle: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  passwordToggleText: {
    color: "#6C6C6C",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#171717",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxChecked: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },
  checkboxDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#FFFFFF",
  },
  termsText: {
    flex: 1,
    color: "#222222",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
  termsTextContainer: {
    flex: 1,
    gap: 4,
  },
  termsLink: {
    color: "#111111",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  termsHint: {
    color: "#7A7A7A",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
  },
  termsError: {
    color: "#B91C1C",
    fontSize: 11,
    lineHeight: 15,
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
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "#F3F3F3",
  },
  modalCard: {
    flex: 1,
    width: "100%",
    backgroundColor: "#F3F3F3",
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 22,
    paddingBottom: 10,
  },
  modalHeaderText: {
    flex: 1,
    gap: 4,
    alignItems: "center",
  },
  modalHeaderSpacer: {
    width: 40,
    height: 40,
  },
  modalTitle: {
    color: "#171717",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  modalSubtitle: {
    color: "#727272",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E6E6",
  },
  modalCloseButtonText: {
    color: "#171717",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  modalHeaderDivider: {
    height: 1,
    backgroundColor: "#E7E7E7",
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 24,
  },
  modalLoadingState: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  modalLoadingText: {
    color: "#5F5F5F",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  modalErrorText: {
    color: "#B91C1C",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  modalDocumentText: {
    color: "#1D1D1D",
    fontSize: 13,
    lineHeight: 22,
    fontWeight: "500",
  },
});

const htmlTagsStyles = {
  body: {
    color: "#1D1D1D",
    fontSize: 13,
    lineHeight: 22,
    fontWeight: "500",
  },
  p: {
    marginTop: 0,
    marginBottom: 14,
  },
  h1: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    color: "#171717",
    marginTop: 0,
    marginBottom: 16,
  },
  h2: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: "#171717",
    marginTop: 18,
    marginBottom: 12,
  },
  h3: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
    color: "#171717",
    marginTop: 16,
    marginBottom: 10,
  },
  ul: {
    marginTop: 0,
    marginBottom: 14,
    paddingLeft: 18,
  },
  ol: {
    marginTop: 0,
    marginBottom: 14,
    paddingLeft: 18,
  },
  li: {
    marginBottom: 8,
  },
  a: {
    color: "#0F62FE",
    textDecorationLine: "underline",
  },
} as const;
