import { getClerkInstance } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { InternalAxiosRequestConfig, create } from "axios";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export const apiClient = create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  headers: {
    Accept: "application/json",
  },
  timeout: 120000,
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (!publishableKey) {
      return config;
    }

    const clerk = getClerkInstance({
      publishableKey,
      tokenCache,
    });
    const token = await clerk.session?.getToken();

    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }

    return config;
  },
  async (error) => Promise.reject(error),
);
