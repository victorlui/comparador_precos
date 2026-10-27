import { apiClient } from "@/services/api/http-client";
import type {
  SearchProductPayload,
  ScanProductPayload,
  ScanProductResponse,
} from "@/services/product-analysis/types";

type ReactNativeUploadFile = {
  uri: string;
  name: string;
  type: string;
};

const buildImageFormData = (imageUri: string) => {
  const formData = new FormData();
  const filename = imageUri.split("/").pop() || "produto.jpg";
  const extension = filename.split(".").pop()?.toLowerCase();

  const mimeType =
    extension === "png"
      ? "image/png"
      : extension === "heic"
        ? "image/heic"
        : "image/jpeg";

  const file: ReactNativeUploadFile = {
    uri: imageUri,
    name: filename,
    type: mimeType,
  };

  formData.append("file", file as unknown as Blob);

  return formData;
};

export async function scanProduct({
  imageUri,
}: ScanProductPayload): Promise<ScanProductResponse> {
  const formData = buildImageFormData(imageUri);

  const { data } = await apiClient.post<ScanProductResponse>(
    "/scan",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return data;
}

export async function searchProductByName({
  query,
}: SearchProductPayload): Promise<ScanProductResponse> {
  const normalizedQuery = query.trim();

  const { data } = await apiClient.post<ScanProductResponse>("/scan/search", {
    query: normalizedQuery,
  });

  return data;
}
