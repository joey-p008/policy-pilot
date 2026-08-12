export const REQUESTER_PROFILE_STORAGE_KEY = 'policy-pilot.requester-profile';

export const REQUESTER_TITLES = [
  'Account Executive / Sales Representative',
  'AI Safety Board Chair / Chief Scientist',
  'Chief Financial Officer (CFO)',
  'Chief Human Resources Officer (CHRO)',
  'Chief Information Security Officer (CISO)',
  'Chief Intellectual Property Counsel',
  'Chief Risk Officer (CRO)',
  'Corporate Accountant',
  'Corporate Legal Counsel',
  'Customer Success Representative',
  'Customer Support Engineer',
  'Cybersecurity Analyst',
  'Data Governance Owner',
  'Data Protection Officer (DPO)',
  'External Contractor / Temporary Staff / External Auditor',
  'HR Staff / HR Operations Specialist',
  'IT Operations / Helpdesk Representative',
  'Lead Infrastructure Security Officer',
  'Lead Vendor Risk Officer',
  'Marketing Analyst',
  'Payroll Operator',
  'Platform Engineer / DevOps Engineer',
  'Product Manager',
  'Senior Data Analyst',
  'Software Engineer / Core Engineer',
  'Treasury Analyst',
  'Vice President of Engineering (VP of Engineering)',
  'Vice President of Finance (VP of Finance)',
  'Vice President of R&D (VP of R&D)',
] as const;

export const REQUESTER_DEPARTMENTS = [
  'AI/ML Research & Engineering',
  'Core Engineering',
  'Corporate Accounting',
  'Customer Support',
  'Data Science & Machine Learning',
  'DevOps & Platform Engineering',
  'Enterprise Sales',
  'Finance Analytics',
  'Human Resources Operations',
  'Information Security / SOC',
  'IT Operations / IT Helpdesk',
  'Legal & Compliance',
  'Marketing Intelligence',
  'Payroll Operations',
  'Procurement Operations',
  'Product Management',
  'Supply Chain & Logistics',
  'Treasury & Cash Management',
] as const;

export const REQUESTER_COST_CENTERS = [
  'CC-ACCT-02',
  'CC-AI-08',
  'CC-DS-01',
  'CC-ENG-01',
  'CC-FIN-01',
  'CC-FIN-07',
  'CC-HR-02',
  'CC-IT-05',
  'CC-LEG-05',
  'CC-MKT-02',
  'CC-OPS-03',
  'CC-PROC-02',
  'CC-PRODUCT-04',
  'CC-SALES-03',
  'CC-SEC-09',
  'CC-SUP-06',
  'CC-SUPP-04',
  'CC-TRE-01',
] as const;

export interface RequesterProfile {
  title: string;
  department: string;
  costCenter: string;
}

function isCatalogMember(value: unknown, catalog: readonly string[]): value is string {
  return typeof value === 'string' && catalog.includes(value.trim());
}

export function selectRequesterProfileValue(
  stored: string | undefined,
  catalog: readonly string[],
): string {
  if (stored === undefined) {
    return '';
  }
  const trimmed = stored.trim();
  return catalog.includes(trimmed) ? trimmed : '';
}

export function isRequesterProfileComplete(
  profile: RequesterProfile | null,
): profile is RequesterProfile {
  return (
    profile !== null &&
    isCatalogMember(profile.title, REQUESTER_TITLES) &&
    isCatalogMember(profile.department, REQUESTER_DEPARTMENTS) &&
    isCatalogMember(profile.costCenter, REQUESTER_COST_CENTERS)
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
