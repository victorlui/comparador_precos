import { getClerkErrorMessage } from "@/components/auth/auth-utils";
import { validateSignUpIdentity } from "@/components/auth/sign-up-validation";
import { apiClient } from "@/services/api/http-client";
import { useAuth, useClerk, useSignUp } from "@clerk/expo";
import RenderHTML from "@native-html/render";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
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

type SignUpScreenProps = {
  onBack?: () => void;
};

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
  const { isLoaded } = useAuth();
  const clerk = useClerk();
  const { signUp, fetchStatus } = useSignUp();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingEmailVerification, setAwaitingEmailVerification] =
    useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [legalDocuments, setLegalDocuments] =
    useState<LegalDocumentsResponse | null>(null);
  const [legalLoading, setLegalLoading] = useState(true);
  const [legalError, setLegalError] = useState<string | null>(null);
  const [visibleLegalDocument, setVisibleLegalDocument] =
    useState<LegalDocumentType | null>(null);

  const formBusy = submitting || fetchStatus === "fetching";
  const formDisabled = !isLoaded || formBusy;
  const registrationFieldsDisabled = formDisabled || awaitingEmailVerification;
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

  const finalizeCompletedSignUp = async () => {
    const finalizeResult = await signUp.finalize();

    if (finalizeResult.error) {
      setFormNotice(null);
      setFormError(getClerkErrorMessage(finalizeResult.error));
      return false;
    }

    const accountIsValid = await validateCreatedAccount();
    if (!accountIsValid) {
      return false;
    }

    setAwaitingEmailVerification(false);
    setVerificationCode("");
    setFormNotice(null);
    return true;
  };

  // const handleSSO = async (provider: ProviderName) => {
  //   if (socialButtonsDisabled) {
  //     return;
  //   }

  //   if (!acceptTerms) {
  //     setFormError("Aceite os termos para continuar com o cadastro.");
  //     return;
  //   }

  //   setFormError(null);
  //   setSocialLoading(provider);

  //   try {
  //     const strategy = provider === "google" ? "oauth_google" : "oauth_apple";
  //     const result = await startSSOFlow({
  //       strategy,
  //       redirectUrl,
  //     });

  //     if (result.signIn && !result.signIn.isTransferable) {
  //       await clerk.signOut();
  //       setFormError(
  //         `Ja existe uma conta com ${provider === "google" ? "Google" : "Apple"}. Entre pela tela de login.`,
  //       );
  //       return;
  //     }

  //     if (result.createdSessionId) {
  //       await validateCreatedAccount();
  //       return;
  //     }

  //     setFormError(
  //       "Nao foi possivel concluir o cadastro com esse provedor agora.",
  //     );
  //   } catch (error) {
  //     setFormError(getClerkErrorMessage(error));
  //   } finally {
  //     setSocialLoading(null);
  //   }
  // };

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

    const identityValidationMessage = validateSignUpIdentity({
      fullName: normalizedFullName,
      email: normalizedEmail,
    });

    if (identityValidationMessage) {
      setFormError(identityValidationMessage);
      return;
    }

    if (!acceptTerms) {
      setFormError("Aceite os termos para criar sua conta.");
      return;
    }

    setFormError(null);
    setFormNotice(null);
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
        const accountIsValid = await finalizeCompletedSignUp();
        if (accountIsValid) {
          return;
        }

        return;
      }

      const sendCodeResult = await signUp.verifications.sendEmailCode();

      if (sendCodeResult.error) {
        setFormError(getClerkErrorMessage(sendCodeResult.error));
        return;
      }

      setAwaitingEmailVerification(true);
      setVerificationCode("");
    } catch (error) {
      setFormError(getClerkErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyEmailCode = async () => {
    if (formDisabled) {
      return;
    }

    const normalizedCode = verificationCode.trim();

    if (!normalizedCode) {
      setFormNotice(null);
      setFormError("Digite o código enviado por e-mail para continuar.");
      return;
    }

    setFormError(null);
    setFormNotice(null);
    setSubmitting(true);

    try {
      const result = await signUp.verifications.verifyEmailCode({
        code: normalizedCode,
      });

      if (result.error) {
        setFormError(getClerkErrorMessage(result.error));
        return;
      }

      if (signUp.status === "complete" && signUp.createdSessionId) {
        await finalizeCompletedSignUp();
        return;
      }

      setFormError(
        "O código foi aceito, mas o Clerk ainda não concluiu o cadastro. Tente novamente em instantes.",
      );
    } catch (error) {
      setFormError(getClerkErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendEmailCode = async () => {
    if (formDisabled || !awaitingEmailVerification) {
      return;
    }

    setFormError(null);
    setFormNotice(null);
    setSubmitting(true);

    try {
      const result = await signUp.verifications.sendEmailCode();

      if (result.error) {
        setFormError(getClerkErrorMessage(result.error));
        return;
      }

      setFormNotice(
        "Enviamos um novo código de verificação para o seu e-mail.",
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
        {onBack && !awaitingEmailVerification ? (
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
            <Text style={styles.title}>
              {awaitingEmailVerification
                ? "Verifique seu e-mail"
                : "Crie sua conta"}
            </Text>
            <Text style={styles.subtitle}>
              {awaitingEmailVerification
                ? "Digite o código enviado para o e-mail informado para concluir a criação da conta."
                : "Informe nome, e-mail e senha para criar sua conta e começarar preços."}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.formSection}>
              {!awaitingEmailVerification ? (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nome completo</Text>
                    <TextInput
                      autoCapitalize="words"
                      autoComplete="name"
                      editable={!registrationFieldsDisabled}
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
                      editable={!registrationFieldsDisabled}
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
                        editable={!registrationFieldsDisabled}
                        onChangeText={setPassword}
                        placeholder="Crie uma senha"
                        placeholderTextColor="#9A9A9A"
                        secureTextEntry={!showPassword}
                        style={styles.passwordInput}
                        value={password}
                      />
                      <Pressable
                        accessibilityRole="button"
                        disabled={registrationFieldsDisabled}
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
                    style={[
                      styles.termsRow,
                      registrationFieldsDisabled && styles.buttonDisabled,
                    ]}
                  >
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: acceptTerms }}
                      disabled={registrationFieldsDisabled}
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
                </>
              ) : (
                <View style={styles.verificationSection}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Código de verificação</Text>
                    <TextInput
                      autoCapitalize="none"
                      autoComplete="one-time-code"
                      editable={!formDisabled}
                      keyboardType="number-pad"
                      onChangeText={setVerificationCode}
                      placeholder="Digite o código"
                      placeholderTextColor="#9A9A9A"
                      style={styles.input}
                      value={verificationCode}
                    />
                  </View>
                </View>
              )}
            </View>

            {formNotice ? (
              <Text style={styles.formNotice}>{formNotice}</Text>
            ) : null}
            {formError ? (
              <Text style={styles.formError}>{formError}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={formDisabled}
              onPress={() => {
                void (awaitingEmailVerification
                  ? handleVerifyEmailCode()
                  : handleSignUp());
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
                <Text style={styles.primaryButtonText}>
                  {awaitingEmailVerification
                    ? "Confirmar código"
                    : "Criar conta"}
                </Text>
              </View>
            </Pressable>

            {awaitingEmailVerification ? (
              <Pressable
                accessibilityRole="button"
                disabled={formDisabled}
                onPress={() => {
                  void handleResendEmailCode();
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  (pressed || formBusy) && styles.buttonPressed,
                  formDisabled && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Reenviar código</Text>
              </Pressable>
            ) : null}
          </View>

          {!awaitingEmailVerification && (
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
          )}
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
  formNotice: {
    color: "#1D4ED8",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  verificationSection: {
    gap: 8,
    paddingTop: 8,
  },
  verificationTitle: {
    color: "#171717",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  verificationDescription: {
    color: "#6C6C6C",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D0D0D",
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
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
  secondaryButtonText: {
    color: "#171717",
    fontSize: 13,
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
