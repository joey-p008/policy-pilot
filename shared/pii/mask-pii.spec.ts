import { maskPII } from './mask-pii';

describe('maskPII', () => {
  it('masks known PII fields while preserving other values', () => {
    const result = maskPII({
      request_id: 'req-123',
      employee_id: 'E1234567',
      cost_center: 'CC-9001',
      decision: 'ESCALATE',
    });

    expect(result).toEqual({
      request_id: 'req-123',
      employee_id: 'E1***67',
      cost_center: 'CC***01',
      decision: 'ESCALATE',
    });
  });

  it('masks nested PII fields', () => {
    const result = maskPII({
      payload: {
        email: 'alice@example.com',
        ssn: '123-45-6789',
      },
    });

    expect(result.payload.email).toBe('al***om');
    expect(result.payload.ssn).toBe('12***89');
  });
});
