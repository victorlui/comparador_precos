import { getMappedClerkErrorMessage } from "@/components/auth/clerk-error-helper";
import { apiClient } from "@/services/api/http-client";
import { isAxiosError } from "axios";

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

type LegalConsentResponse = {
  id: string;
  user_id: string;
  terms_of_use_document_id: string;
  privacy_policy_document_id: string;
  terms_of_use_version: string;
  privacy_policy_version: string;
  accepted_terms_of_use: boolean;
  accepted_privacy_policy: boolean;
  responded_at: string;
  created_at: string;
};

type AcceptCurrentLegalDocumentsOptions = {
  getToken?: () => Promise<string | null | undefined>;
};

export function getClerkErrorMessage(error: unknown) {
  return getMappedClerkErrorMessage(error);
}

export async function acceptCurrentLegalDocumentsIfNeeded(
  options?: AcceptCurrentLegalDocumentsOptions,
) {
  const authHeaders = await getAuthorizationHeaders(options?.getToken);

  await waitForAuthenticatedBackendSession(authHeaders);

  const { data: documents } = await apiClient.get<LegalDocumentsResponse>(
    "/legal/documents",
    {
      headers: authHeaders,
    },
  );

  const { data: currentConsent } =
    await apiClient.get<LegalConsentResponse | null>("/legal/consents/me", {
      headers: authHeaders,
    });

  const consentIsCurrent =
    currentConsent?.terms_of_use_document_id === documents.terms_of_use.id &&
    currentConsent?.privacy_policy_document_id ===
      documents.privacy_policy.id &&
    currentConsent.accepted_terms_of_use &&
    currentConsent.accepted_privacy_policy;

  if (consentIsCurrent) {
    return;
  }

  await apiClient.post(
    "/legal/consents",
    {
      terms_of_use_document_id: documents.terms_of_use.id,
      privacy_policy_document_id: documents.privacy_policy.id,
      accepted_terms_of_use: true,
      accepted_privacy_policy: true,
    },
    {
      headers: authHeaders,
    },
  );
}

async function waitForAuthenticatedBackendSession(
  authHeaders?: Record<string, string>,
) {
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await apiClient.get("/auth/me", {
        headers: authHeaders,
      });
      return;
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      const statusCode = isAxiosError(error)
        ? error.response?.status
        : undefined;
      const shouldRetry = statusCode === 401 || statusCode === 403;

      if (isLastAttempt || !shouldRetry) {
        throw error;
      }

      await delay(350);
    }
  }
}

async function getAuthorizationHeaders(
  getToken?: () => Promise<string | null | undefined>,
) {
  if (!getToken) {
    return undefined;
  }

  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const token = await getToken();
    if (token) {
      return {
        Authorization: `Bearer ${token}`,
      };
    }

    if (attempt < maxAttempts) {
      await delay(250);
    }
  }

  return undefined;
}

function delay(timeoutMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}
