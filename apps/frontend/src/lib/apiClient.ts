import axios, { type AxiosInstance } from 'axios';

import { DEMO_ACTOR_ID_HEADER, DEMO_ROLE_HEADER } from '../api/hitl-constants';
import { getDemoIdentity } from './demo-identity';

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

apiClient.interceptors.request.use((config) => {
  const identity = getDemoIdentity();
  config.headers.set(DEMO_ROLE_HEADER, identity.role);
  config.headers.set(DEMO_ACTOR_ID_HEADER, identity.actorId);
  return config;
});
