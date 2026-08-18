import { decodeJwtPayload, parseOidcRoleClaim, roleFromAccessToken } from './jwt-payload';

describe('jwt-payload', () => {
  it('decodes a well-formed JWT payload', () => {
    const payload = Buffer.from(
      JSON.stringify({ sub: 'user-1', 'https://policy-pilot.local/roles': 'admin' }),
      'utf8',
    ).toString('base64url');
    const token = `header.${payload}.signature`;

    expect(decodeJwtPayload(token)).toEqual({
      sub: 'user-1',
      'https://policy-pilot.local/roles': 'admin',
    });
  });

  it('returns null for a malformed token', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
  });

  it('parses string and array role claims', () => {
    expect(parseOidcRoleClaim('admin')).toBe('admin');
    expect(parseOidcRoleClaim(['user', 'admin'])).toBe('admin');
    expect(parseOidcRoleClaim(['viewer'])).toBeUndefined();
  });

  it('reads the role claim from an access token', () => {
    const payload = Buffer.from(
      JSON.stringify({ 'https://policy-pilot.local/roles': ['user'] }),
      'utf8',
    ).toString('base64url');

    expect(roleFromAccessToken(`h.${payload}.s`, 'https://policy-pilot.local/roles')).toBe('user');
  });
});
