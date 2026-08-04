const PII_KEYS = new Set(['employee_id', 'cost_center', 'ssn', 'email']);

function maskValue(value: string): string {
  if (value.length <= 4) {
    return '****';
  }

  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function maskPII<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => maskPII(item)) as T;
  }

  if (input !== null && typeof input === 'object') {
    const maskedEntries = Object.entries(input as Record<string, unknown>).map(([key, value]) => {
      if (PII_KEYS.has(key) && typeof value === 'string') {
        return [key, maskValue(value)];
      }

      return [key, maskPII(value)];
    });

    return Object.fromEntries(maskedEntries) as T;
  }

  return input;
}
