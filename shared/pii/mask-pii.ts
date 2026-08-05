const PII_KEYS = new Set(['employee_id', 'cost_center', 'ssn', 'email']);

function maskValue(value: string): string {
  if (value.length <= 4) {
    return '****';
  }

  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function isPlainObject(value: object): value is Record<string, unknown> {
  return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
}

function isMaskablePrimitive(value: unknown): value is string | number | boolean | bigint {
  const valueType = typeof value;
  return (
    valueType === 'string' ||
    valueType === 'number' ||
    valueType === 'boolean' ||
    valueType === 'bigint'
  );
}

export function maskPII<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => maskPII(item)) as T;
  }

  if (input !== null && typeof input === 'object') {
    if (!isPlainObject(input)) {
      return input;
    }

    const maskedEntries = Object.entries(input).map(([key, value]) => {
      if (PII_KEYS.has(key)) {
        if (value === null || value === undefined) {
          return [key, value];
        }

        if (isMaskablePrimitive(value)) {
          return [key, maskValue(String(value))];
        }
      }

      return [key, maskPII(value)];
    });

    return Object.fromEntries(maskedEntries) as T;
  }

  return input;
}
