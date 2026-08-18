import type { DemoRole } from '@policy-pilot/shared-types';

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
