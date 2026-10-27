const TEMP_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "disposablemail.com",
  "dispostable.com",
  "emailnator.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getnada.com",
  "grr.la",
  "guerrillamail.biz",
  "guerrillamail.com",
  "guerrillamailblock.com",
  "harakirimail.com",
  "jetable.org",
  "mail.tm",
  "maildrop.cc",
  "mailinator.com",
  "mailnesia.com",
  "mintemail.com",
  "moakt.com",
  "muellmail.com",
  "mytemp.email",
  "nada.email",
  "secmail.com",
  "sharklasers.com",
  "spamgourmet.com",
  "spambox.us",
  "temp-mail.io",
  "temp-mail.org",
  "temp-mail.ru",
  "tempmail.com",
  "tempmail.dev",
  "tempmailo.com",
  "throwawaymail.com",
  "tmpmail.org",
  "trashmail.de",
  "trashmail.com",
  "yopmail.com",
]);

const EMAIL_PATTERN =
  /^(?=.{6,254}$)(?=.{1,64}@)[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

const NAME_CONNECTORS = new Set([
  "da",
  "das",
  "de",
  "del",
  "della",
  "di",
  "do",
  "dos",
  "du",
  "e",
  "van",
  "von",
]);

const SUSPICIOUS_NAME_PATTERN =
  /<|>|https?:\/\/|www\.|@|--|\/\*|\*\/|select\s+|insert\s+|delete\s+|drop\s+|union\s+/i;

const NAME_TOKEN_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'-]*$/u;

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isTemporaryEmailDomain(domain: string) {
  for (const blockedDomain of TEMP_EMAIL_DOMAINS) {
    if (domain === blockedDomain || domain.endsWith(`.${blockedDomain}`)) {
      return true;
    }
  }

  return false;
}

function validateFullName(fullName: string) {
  const normalizedName = normalizeWhitespace(fullName);

  if (!normalizedName) {
    return "Preencha seu nome completo.";
  }

  if (normalizedName.length < 5) {
    return "Informe nome e sobrenome para continuar.";
  }

  if (normalizedName.length > 120) {
    return "Seu nome completo esta muito longo.";
  }

  if (SUSPICIOUS_NAME_PATTERN.test(normalizedName)) {
    return "Digite um nome valido, sem links ou caracteres suspeitos.";
  }

  const parts = normalizedName.split(" ");
  if (parts.length < 2) {
    return "Informe nome e sobrenome para continuar.";
  }

  for (const part of parts) {
    const loweredPart = part.toLowerCase();
    if (NAME_CONNECTORS.has(loweredPart)) {
      continue;
    }

    if (!NAME_TOKEN_PATTERN.test(part)) {
      return "Digite um nome valido usando apenas letras.";
    }

    const lettersOnly = Array.from(part).filter((character) =>
      /[\p{L}\p{M}]/u.test(character),
    );

    if (lettersOnly.length < 2) {
      return "Digite um nome valido usando apenas letras.";
    }
  }

  return null;
}

function validateEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return "Preencha seu e-mail.";
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return "Digite um e-mail valido.";
  }

  const [localPart, domain] = normalizedEmail.split("@");
  if (
    !localPart ||
    !domain ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    domain.includes("..")
  ) {
    return "Digite um e-mail valido.";
  }

  if (isTemporaryEmailDomain(domain)) {
    return "Use um e-mail permanente. E-mails temporarios nao sao aceitos.";
  }

  return null;
}

type SignUpIdentityInput = {
  fullName: string;
  email: string;
};

export function validateSignUpIdentity(input: SignUpIdentityInput) {
  const nameError = validateFullName(input.fullName);
  if (nameError) {
    return nameError;
  }

  return validateEmail(input.email);
}
