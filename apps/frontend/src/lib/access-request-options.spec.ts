import {
  ACCESS_REQUEST_SYSTEM_ENTITLEMENTS,
  ACCESS_REQUEST_SYSTEM_NAMES,
  getEntitlementKeysForSystem,
  isValidSystemEntitlementPair,
} from './access-request-options';

describe('access-request-options', () => {
  it('derives sorted system names from the entitlement map', () => {
    expect(ACCESS_REQUEST_SYSTEM_NAMES).toEqual(
      Object.keys(ACCESS_REQUEST_SYSTEM_ENTITLEMENTS).sort(),
    );
    expect(ACCESS_REQUEST_SYSTEM_NAMES).not.toContain('BENEFITS_PORTAL');
    expect(ACCESS_REQUEST_SYSTEM_NAMES).not.toContain('SALES_FORCE_TENANT');
    expect(ACCESS_REQUEST_SYSTEM_NAMES).not.toContain('VECTOR_EMBEDDING_STORE');
  });

  it('returns mapped entitlement keys for a known system', () => {
    expect(getEntitlementKeysForSystem('DATA_WAREHOUSE')).toEqual(['FIN_DATASET_READ']);
    expect(getEntitlementKeysForSystem('FINANCE_ANALYTICS_DB')).toEqual([
      'FIN_DATASET_EDIT',
      'FIN_BILLING_EXPORT',
    ]);
  });

  it('returns an empty list for an unknown system', () => {
    expect(getEntitlementKeysForSystem('BENEFITS_PORTAL')).toEqual([]);
    expect(getEntitlementKeysForSystem('')).toEqual([]);
  });

  it('accepts mapped pairs and rejects cross-system entitlement keys', () => {
    expect(isValidSystemEntitlementPair('DATA_WAREHOUSE', 'FIN_DATASET_READ')).toBe(true);
    expect(isValidSystemEntitlementPair('DATA_WAREHOUSE', 'FIN_DATASET_EDIT')).toBe(false);
    expect(isValidSystemEntitlementPair('FINANCE_ANALYTICS_DB', 'FIN_DATASET_EDIT')).toBe(true);
  });
});
