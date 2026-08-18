import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { getAuthSession } from './auth-session';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  retryAfterAuth?: boolean;
}

let unauthorizedHandler: (() => Promise<string | null>) | null = null;

export function setUnauthorizedHandler(handler: (() => Promise<string | null>) | null): void {
  unauthorizedHandler = handler;
}

function resolveApiBaseUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  // Empty string means same-origin (production SPA served by Nest).
  // Undefined/missing keeps the local Vite default.
  if (typeof configuredBaseUrl === 'string') {
    return configuredBaseUrl;
  }
  return DEFAULT_API_BASE_URL;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const session = getAuthSession();
  if (session !== null && session.accessToken.length > 0) {
    config.headers.set('Authorization', `Bearer ${session.accessToken}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableRequestConfig | undefined;
    if (
      error.response?.status === 401 &&
      config !== undefined &&
      config.retryAfterAuth !== true &&
      unauthorizedHandler !== null
    ) {
      config.retryAfterAuth = true;
      const token = await unauthorizedHandler();
      if (token !== null && token.length > 0) {
        config.headers.set('Authorization', `Bearer ${token}`);
        return apiClient.request(config);
      }
    }
    return Promise.reject(error);
  },
);
