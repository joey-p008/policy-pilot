import axios, { type AxiosInstance } from 'axios';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

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
