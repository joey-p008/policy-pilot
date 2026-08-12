import { createHash } from 'node:crypto';

import { hashIdentifier } from './hash-identifier';

describe('hashIdentifier', () => {
  it('returns a SHA-256 hex digest of the input', () => {
    const value = 'EMP-52190';
    expect(hashIdentifier(value)).toBe(createHash('sha256').update(value, 'utf8').digest('hex'));
  });
});
