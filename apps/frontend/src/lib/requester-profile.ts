export const REQUESTER_PROFILE_STORAGE_KEY = 'policy-pilot.requester-profile';

export interface RequesterProfile {
  title: string;
  department: string;
  costCenter: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isRequesterProfileComplete(
  profile: RequesterProfile | null,
): profile is RequesterProfile {
  return (
    profile !== null &&
    isNonEmptyString(profile.title) &&
    isNonEmptyString(profile.department) &&
    isNonEmptyString(profile.costCenter)
  );
}

export function parseRequesterProfile(value: unknown): RequesterProfile | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const profile: RequesterProfile = {
    title: typeof record.title === 'string' ? record.title.trim() : '',
    department: typeof record.department === 'string' ? record.department.trim() : '',
    costCenter: typeof record.costCenter === 'string' ? record.costCenter.trim() : '',
  };

  return isRequesterProfileComplete(profile) ? profile : null;
}

export function readStoredRequesterProfile(): RequesterProfile | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(REQUESTER_PROFILE_STORAGE_KEY);
  if (raw === null) {
    return null;
  }

  try {
    return parseRequesterProfile(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeStoredRequesterProfile(profile: RequesterProfile): RequesterProfile {
  const normalized: RequesterProfile = {
    title: profile.title.trim(),
    department: profile.department.trim(),
    costCenter: profile.costCenter.trim(),
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(REQUESTER_PROFILE_STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}

export function clearStoredRequesterProfile(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(REQUESTER_PROFILE_STORAGE_KEY);
  }
}
