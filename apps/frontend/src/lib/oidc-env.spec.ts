import { isOidcEnvConfigured } from './oidc-env';

describe('isOidcEnvConfigured', () => {
  const configured = {
    authority: 'https://tenant.auth0.com/',
    clientId: 'abc123',
    audience: 'https://policy-pilot.local/api',
    redirectUri: 'http://localhost:5173/callback',
    postLogoutRedirectUri: 'http://localhost:5173',
  };

  it('returns true when every OIDC value is a real tenant setting', () => {
    expect(isOidcEnvConfigured(configured)).toBe(true);
  });

  it('returns false for placeholder Auth0 host or client id', () => {
    expect(
      isOidcEnvConfigured({
        ...configured,
        authority: 'https://your-tenant.auth0.com/',
      }),
    ).toBe(false);
    expect(
      isOidcEnvConfigured({
        ...configured,
        clientId: 'local-unconfigured',
      }),
    ).toBe(false);
  });

  it('returns false when a required value is missing', () => {
    expect(isOidcEnvConfigured({ ...configured, audience: '' })).toBe(false);
    expect(isOidcEnvConfigured({ ...configured, clientId: undefined })).toBe(false);
  });
});
