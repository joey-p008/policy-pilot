import { resolvePolicyDocumentPrefix } from './system-policy-document-prefix';

describe('resolvePolicyDocumentPrefix', () => {
  it('maps a catalog system name to its policy document prefix', () => {
    expect(resolvePolicyDocumentPrefix('DATA_WAREHOUSE')).toBe('POL-2026-01-DGW');
    expect(resolvePolicyDocumentPrefix('CLOUD_INFRASTRUCTURE')).toBe('POL-2026-02-SEC');
  });

  it('extracts the system name from a composite target resource', () => {
    expect(resolvePolicyDocumentPrefix('DATA_WAREHOUSE / FIN_DATASET')).toBe('POL-2026-01-DGW');
    expect(resolvePolicyDocumentPrefix('CLOUD_INFRASTRUCTURE / PROD')).toBe('POL-2026-02-SEC');
  });

  it('returns undefined for an unknown system so retrieval stays unfiltered', () => {
    expect(resolvePolicyDocumentPrefix('UNKNOWN_SYSTEM')).toBeUndefined();
    expect(resolvePolicyDocumentPrefix('')).toBeUndefined();
  });
});
