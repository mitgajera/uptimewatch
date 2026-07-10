"use client";
import { useAuth } from "@clerk/nextjs";
import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { useCallback, useMemo } from "react";
import { API_BACKEND_URL, CLERK_JWT_TEMPLATE } from "@/config";

/**
 * Thin axios wrapper that injects the Clerk auth token and the API base URL on
 * every request, so components don't repeat the `getToken()` +
 * `Authorization: Bearer` + `${API_BACKEND_URL}/api/v1` boilerplate.
 *
 * Paths are relative to `/api/v1`, e.g. `api.get("/websites")`.
 */
export function useApiClient() {
  const { getToken } = useAuth();

  const request = useCallback(
    async <T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
      const token = await getToken(
        CLERK_JWT_TEMPLATE ? { template: CLERK_JWT_TEMPLATE } : undefined
      );
      if (!token) {
        throw new Error("No auth token available");
      }
      return axios.request<T>({
        ...config,
        baseURL: `${API_BACKEND_URL}/api/v1`,
        headers: { Authorization: `Bearer ${token}`, ...config.headers },
      });
    },
    [getToken]
  );

  return useMemo(
    () => ({
      get: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
        request<T>({ ...config, method: "get", url }),
      post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
        request<T>({ ...config, method: "post", url, data }),
      delete: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
        request<T>({ ...config, method: "delete", url }),
    }),
    [request]
  );
}
