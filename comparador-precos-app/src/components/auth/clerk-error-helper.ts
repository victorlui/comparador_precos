type ClerkErrorMeta = {
  name?: string;
};

type ClerkErrorCandidate = {
  code?: string;
  message?: string;
  longMessage?: string;
  shortMessage?: string;
  detail?: string;
  meta?: ClerkErrorMeta | string | null;
};

const DEFAULT_AUTH_ERROR_MESSAGE =
  "Não foi possível concluir a autenticação agora.";

const DUPLICATE_BACKEND_EMAIL_MESSAGE =
  "Já existe uma conta cadastrada com este e-mail. Entre pela tela de login.";

const CLERK_ERROR_MESSAGES_BY_CODE: Record<string, string> = {
  actor_token_already_used_code:
    "Esse link de acesso já foi usado. Solicite um novo.",
  agent_task_already_used:
    "Esse link de acesso já foi usado. Solicite um novo.",
  authentication_invalid:
    "Sua sessão não é válida no momento. Entre novamente para continuar.",
  authorization_invalid: "Você não tem permissão para fazer essa ação agora.",
  authorization_header_format_invalid:
    "Não foi possível validar a autenticação enviada pelo app.",
  client_not_found:
    "Não foi possível localizar a configuração de autenticação do app.",
  csrf_token_invalid: "Sua sessão expirou. Tente novamente.",
  form_identifier_exists: "Este e-mail já está em uso. Tente outro.",
  host_invalid:
    "A configuração do Clerk parece inválida. Verifique a chave pública do app.",
  identification_exists: "Este e-mail já está em uso. Tente outro.",
  invalid_handshake:
    "Não foi possível iniciar a autenticação com esse provedor agora.",
  not_allowed_access:
    "Esse método de autenticação não está liberado para esta conta.",
  origin_invalid:
    "A origem da autenticação não foi aceita pela configuração atual.",
  request_invalid_for_environment:
    "Esse tipo de autenticação não está disponível neste ambiente.",
  resource_not_found: "Não encontramos o recurso de autenticação solicitado.",
  session_exists: "Já existe uma sessão ativa para esta conta.",
  strategy_for_user_invalid:
    "Esse método de login não está disponível para esta conta.",
  url_based_session_syncing_disabled:
    "A sincronização de sessão usada por este fluxo está desativada.",
  user_settings_invalid:
    "As configurações de autenticação do Clerk estão inválidas.",
};

const CLERK_ERROR_MESSAGE_SUBSTRINGS: [string, string][] = [
  [
    "That email address is taken. Please try another.",
    "Este e-mail já está em uso. Tente outro.",
  ],
  [
    "This email address is already in use.",
    "Este e-mail já está em uso. Tente outro.",
  ],
  [
    "Creating multiple accounts with the same email address is not allowed.",
    "Este e-mail já está em uso. Tente outro.",
  ],
  [DUPLICATE_BACKEND_EMAIL_MESSAGE, DUPLICATE_BACKEND_EMAIL_MESSAGE],
  ["Couldn't find your account.", "Não encontramos uma conta com esses dados."],
  ["Enter password", "Digite sua senha para continuar."],
  [
    "Password is incorrect. Try again, or use another method.",
    "Senha incorreta. Tente novamente ou use outro método.",
  ],
  [
    "Passwords must be 15 characters or more.",
    "Senha deve ter pelo menos 15 caracteres.",
  ],
  [
    "This account requires a password reset before sign-in can continue.",
    "Esta conta entrou em um estado de seguranca do Clerk e precisa redefinir a senha antes de continuar. Isso costuma acontecer quando uma conta criada por e-mail/senha e depois vinculada a um login social ainda nao tinha o e-mail verificado.",
  ],
  ["Session already exists", "Já existe uma sessão ativa para esta conta."],
];

function normalizeClerkErrorMeta(
  meta: ClerkErrorCandidate["meta"],
): ClerkErrorMeta | null {
  if (!meta) {
    return null;
  }

  if (typeof meta === "string") {
    try {
      const parsedMeta = JSON.parse(meta) as ClerkErrorMeta;
      return typeof parsedMeta === "object" && parsedMeta !== null
        ? parsedMeta
        : null;
    } catch {
      return null;
    }
  }

  return meta;
}

function translateKnownMessage(message: string) {
  for (const [substring, translatedMessage] of CLERK_ERROR_MESSAGE_SUBSTRINGS) {
    if (message.includes(substring)) {
      return translatedMessage;
    }
  }

  return message;
}

function mapClerkCodeToMessage(candidate: ClerkErrorCandidate) {
  const normalizedMeta = normalizeClerkErrorMeta(candidate.meta);

  if (candidate.code === "not_allowed_access") {
    if (normalizedMeta?.name === "email_address") {
      return "Esse formato de e-mail não é aceito. Use outro e-mail.";
    }

    if (normalizedMeta?.name === "phone_number") {
      return "Esse número não pode ser usado para cadastro.";
    }
  }

  if (!candidate.code) {
    return null;
  }

  return CLERK_ERROR_MESSAGES_BY_CODE[candidate.code] ?? null;
}

function getErrorCandidates(error: unknown): ClerkErrorCandidate[] {
  if (!error || typeof error !== "object") {
    return [];
  }

  const candidates: ClerkErrorCandidate[] = [];
  const errorRecord = error as {
    errors?: unknown;
    response?: {
      data?: {
        errors?: unknown;
        detail?: unknown;
        message?: unknown;
        code?: unknown;
      };
    };
    detail?: unknown;
    message?: unknown;
    code?: unknown;
    longMessage?: unknown;
    shortMessage?: unknown;
    meta?: unknown;
  };

  if (Array.isArray(errorRecord.errors)) {
    for (const item of errorRecord.errors) {
      if (item && typeof item === "object") {
        candidates.push(item as ClerkErrorCandidate);
      }
    }
  }

  if (
    errorRecord.response?.data?.errors &&
    Array.isArray(errorRecord.response.data.errors)
  ) {
    for (const item of errorRecord.response.data.errors) {
      if (item && typeof item === "object") {
        candidates.push(item as ClerkErrorCandidate);
      }
    }
  }

  candidates.push({
    code: typeof errorRecord.code === "string" ? errorRecord.code : undefined,
    detail:
      typeof errorRecord.detail === "string" ? errorRecord.detail : undefined,
    longMessage:
      typeof errorRecord.longMessage === "string"
        ? errorRecord.longMessage
        : undefined,
    message:
      typeof errorRecord.message === "string" ? errorRecord.message : undefined,
    meta:
      typeof errorRecord.meta === "object" ||
      typeof errorRecord.meta === "string"
        ? (errorRecord.meta as ClerkErrorCandidate["meta"])
        : undefined,
    shortMessage:
      typeof errorRecord.shortMessage === "string"
        ? errorRecord.shortMessage
        : undefined,
  });

  if (errorRecord.response?.data) {
    candidates.push({
      code:
        typeof errorRecord.response.data.code === "string"
          ? errorRecord.response.data.code
          : undefined,
      detail:
        typeof errorRecord.response.data.detail === "string"
          ? errorRecord.response.data.detail
          : undefined,
      message:
        typeof errorRecord.response.data.message === "string"
          ? errorRecord.response.data.message
          : undefined,
    });
  }

  return candidates;
}

export function getMappedClerkErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return translateKnownMessage(error);
  }

  for (const candidate of getErrorCandidates(error)) {
    const mappedCodeMessage = mapClerkCodeToMessage(candidate);
    if (mappedCodeMessage) {
      return mappedCodeMessage;
    }

    if (candidate.longMessage) {
      return translateKnownMessage(candidate.longMessage);
    }

    if (candidate.message) {
      return translateKnownMessage(candidate.message);
    }

    if (candidate.detail) {
      return translateKnownMessage(candidate.detail);
    }

    if (candidate.shortMessage) {
      return translateKnownMessage(candidate.shortMessage);
    }
  }

  if (error instanceof Error && error.message) {
    return translateKnownMessage(error.message);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "toString" in error &&
    typeof error.toString === "function"
  ) {
    const serializedError = error.toString();
    if (serializedError && serializedError !== "[object Object]") {
      return translateKnownMessage(serializedError);
    }
  }

  return DEFAULT_AUTH_ERROR_MESSAGE;
}
