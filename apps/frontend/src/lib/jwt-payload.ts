import type { DemoRole } from '@policy-pilot/shared-types';

function padBase64(value: string): string {
  const remainder = value.length % 4;
  if (remainder === 0) {
    return value;
  }
  return `${value}${'='.repeat(4 - remainder)}`;
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  const encoded = parts[1];
  if (parts.length !== 3 || encoded === undefined) {
    return null;
  }

  try {
    const padded = padBase64(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const json = globalThis.atob(padded);
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseOidcRoleClaim(value: unknown): DemoRole | undefined {
  if (typeof value === 'string') {
    if (value === 'admin' || value === 'user') {
      return value;
    }
    return undefined;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const roles = value.filter((item): item is string => typeof item === 'string');
  if (roles.includes('admin')) {
    return 'admin';
  }
  if (roles.includes('user')) {
    return 'user';
  }
  return undefined;
}

export function roleFromAccessToken(token: string, roleClaim: string): DemoRole | undefined {
  const payload = decodeJwtPayload(token);
  if (payload === null) {
    return undefined;
  }
  return parseOidcRoleClaim(payload[roleClaim]);
}
