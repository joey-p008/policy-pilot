import { maskPII } from './mask-pii';

const RAW_EMPLOYEE_ID = 'E1234567';
const RAW_COST_CENTER = 'CC-9001';
const RAW_EMAIL = 'alice@example.com';
const RAW_SSN = '123-45-6789';

function assertNoRawPiiEscapes(value: unknown): void {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain(RAW_EMPLOYEE_ID);
  expect(serialized).not.toContain(RAW_COST_CENTER);
  expect(serialized).not.toContain(RAW_EMAIL);
  expect(serialized).not.toContain(RAW_SSN);
}

describe('maskPII', () => {
  it('masks known PII fields while preserving other values', () => {
    const result = maskPII({
      request_id: 'req-123',
      employee_id: RAW_EMPLOYEE_ID,
      cost_center: RAW_COST_CENTER,
      decision: 'ESCALATE',
    });

    expect(result).toEqual({
      request_id: 'req-123',
      employee_id: 'E1***67',
      cost_center: 'CC***01',
      decision: 'ESCALATE',
    });
    assertNoRawPiiEscapes(result);
  });

  it('masks nested PII fields', () => {
    const result = maskPII({
      payload: {
        email: RAW_EMAIL,
        ssn: RAW_SSN,
      },
    });

    expect(result.payload.email).toBe('al***om');
    expect(result.payload.ssn).toBe('12***89');
    assertNoRawPiiEscapes(result);
  });

  it('masks PII fields inside arrays of records', () => {
    const result = maskPII([
      { employee_id: RAW_EMPLOYEE_ID, request_id: 'req-1' },
      { cost_center: RAW_COST_CENTER, request_id: 'req-2' },
    ]);

    expect(result).toEqual([
      { employee_id: 'E1***67', request_id: 'req-1' },
      { cost_center: 'CC***01', request_id: 'req-2' },
    ]);
    assertNoRawPiiEscapes(result);
  });

  it('fully redacts short PII values', () => {
    const result = maskPII({
      employee_id: 'E12',
      cost_center: 'CC1',
      email: 'ab',
      ssn: '12',
    });

    expect(result).toEqual({
      employee_id: '****',
      cost_center: '****',
      email: '****',
      ssn: '****',
    });
  });

  it('passes through primitives and null unchanged', () => {
    expect(maskPII('plain-string')).toBe('plain-string');
    expect(maskPII(42)).toBe(42);
    expect(maskPII(true)).toBe(true);
    expect(maskPII(null)).toBeNull();
    expect(maskPII(undefined)).toBeUndefined();
  });

  it('scrubs numeric and boolean PII values after stringification', () => {
    const result = maskPII({
      employee_id: 12345678,
      cost_center: true,
      ssn: 99999n,
    });

    expect(result.employee_id).toBe('12***78');
    expect(result.cost_center).toBe('****');
    expect(result.ssn).toBe('99***99');
    expect(JSON.stringify(result)).not.toContain('12345678');
  });

  it('leaves null and undefined PII values as-is', () => {
    const result = maskPII({
      employee_id: null,
      cost_center: undefined,
      request_id: 'req-null',
    });

    expect(result.employee_id).toBeNull();
    expect(result.cost_center).toBeUndefined();
    expect(result.request_id).toBe('req-null');
  });

  it('masks deeply nested employee_id and cost_center', () => {
    const result = maskPII({
      meta: {
        actor: {
          employee_id: RAW_EMPLOYEE_ID,
          cost_center: RAW_COST_CENTER,
          role: 'approver',
        },
      },
    });

    expect(result.meta.actor).toEqual({
      employee_id: 'E1***67',
      cost_center: 'CC***01',
      role: 'approver',
    });
    assertNoRawPiiEscapes(result);
  });

  it('passes through non-plain objects without corrupting them', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const result = maskPII({
      created_at: createdAt,
      employee_id: RAW_EMPLOYEE_ID,
    });

    expect(result.created_at).toBe(createdAt);
    expect(result.employee_id).toBe('E1***67');
    assertNoRawPiiEscapes(result);
  });

  it('handles objects with a null prototype', () => {
    const payload = Object.create(null) as Record<string, string>;
    payload.employee_id = RAW_EMPLOYEE_ID;
    payload.decision = 'APPROVE';

    const result = maskPII(payload);

    expect(result.employee_id).toBe('E1***67');
    expect(result.decision).toBe('APPROVE');
    assertNoRawPiiEscapes(result);
  });
});
