import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import {
  scanProduct,
  searchProductByName,
} from "@/services/product-analysis/scan-product";
import type {
  ScanProductPayload,
  ScanProductResponse,
  SearchProductPayload,
} from "@/services/product-analysis/types";

type ApiErrorResponse = {
  message?: string;
  detail?: string | { message?: string } | { msg?: string }[];
};

export function useScanProductMutation() {
  return useMutation<ScanProductResponse, unknown, ScanProductPayload>({
    mutationFn: scanProduct,
  });
}

export function useSearchProductMutation() {
  return useMutation<ScanProductResponse, unknown, SearchProductPayload>({
    mutationFn: searchProductByName,
  });
}

function getApiErrorDetail(detail: ApiErrorResponse["detail"]) {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item.msg)
      .filter(Boolean)
      .join(" ");
  }

  if (detail?.message) {
    return detail.message;
  }

  return null;
}

export function getScanProductErrorMessage(error: unknown) {
  if (isAxiosError<ApiErrorResponse>(error)) {
    const apiMessage =
      getApiErrorDetail(error.response?.data?.detail) ||
      error.response?.data?.message;

    if (apiMessage) {
      return apiMessage;
    }

    if (!error.response) {
      if (error.code === "ECONNABORTED") {
        return "A API demorou para responder. Tente novamente.";
      }

      return "Não foi possível conectar com a API. Verifique a EXPO_PUBLIC_API_URL e se o servidor está online.";
    }

    if (error.response.status === 413) {
      return "A imagem enviada é muito grande.";
    }

    if (error.response.status === 415) {
      return "Formato de imagem não suportado.";
    }

    if (error.response.status === 422) {
      return "A API rejeitou o arquivo enviado. Verifique se a imagem foi capturada corretamente.";
    }

    if (error.response.status === 504) {
      return "A IA demorou demais para analisar a imagem. Tente novamente.";
    }

    if (error.response.status === 503) {
      return "O OpenRouter está indisponível, com alta demanda ou sem cota no momento. Tente novamente em instantes.";
    }

    if (error.response.status >= 500) {
      return "A API encontrou um erro ao processar a imagem.";
    }

    return error.message || "Falha ao enviar a imagem para o backend.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Falha ao enviar a imagem para o backend.";
}
