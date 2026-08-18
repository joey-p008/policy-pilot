import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

import { OidcAuthConfig } from './oidc-auth.config';
import { OidcTokenVerifier } from './oidc-token.verifier';
import { parseOidcRoleClaim } from './oidc-roles';
import {
  installOidcTestEnv,
  signTestAccessToken,
  TEST_OIDC_ISSUER,
} from '../../../test/oidc-test-keys';

installOidcTestEnv();

function buildVerifier(): OidcTokenVerifier {
  const configService = {
    get: (key: string): string | undefined => process.env[key],
  } as Pick<ConfigService, 'get'>;
  return new OidcTokenVerifier(new OidcAuthConfig(configService as ConfigService));
}

describe('parseOidcRoleClaim', () => {
  it('parses a string role', () => {
    expect(parseOidcRoleClaim('admin')).toBe('admin');
    expect(parseOidcRoleClaim('user')).toBe('user');
    expect(parseOidcRoleClaim('other')).toBeUndefined();
  });

  it('prefers admin when a claim array includes both roles', () => {
    expect(parseOidcRoleClaim(['user', 'admin'])).toBe('admin');
    expect(parseOidcRoleClaim(['user'])).toBe('user');
  });
});

describe('OidcTokenVerifier', () => {
  it('accepts a locally signed token for the configured issuer and audience', async () => {
    const verifier = buildVerifier();
    const token = await signTestAccessToken('user');
    const payload = await verifier.verifyAccessToken(token);

    expect(payload.iss).toBe(TEST_OIDC_ISSUER);
    expect(payload.sub).toBe('oidc-test-subject');
  });

  it('rejects an expired token', async () => {
    const verifier = buildVerifier();
    const token = await signTestAccessToken('admin', { expired: true });

    await expect(verifier.verifyAccessToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
