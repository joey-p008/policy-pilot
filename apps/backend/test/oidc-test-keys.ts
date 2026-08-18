import { generateKeyPairSync } from 'node:crypto';

import type { DemoRole } from '@policy-pilot/shared-types';
import { importPKCS8, SignJWT, type JWTPayload } from 'jose';

export const TEST_OIDC_ISSUER = 'http://localhost/oidc-test';
export const TEST_OIDC_AUDIENCE = 'policy-pilot-api';
export const TEST_OIDC_ROLE_CLAIM = 'https://policy-pilot.local/roles';
export const TEST_OIDC_KEY_ID = 'policy-pilot-test';

interface TestKeyPair {
  publicJwk: Record<string, unknown>;
  privatePem: string;
}

let cachedKeyPair: TestKeyPair | undefined;

function getTestKeyPair(): TestKeyPair {
  if (cachedKeyPair !== undefined) {
    return cachedKeyPair;
  }

  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  const exportedPublic = publicKey.export({ format: 'jwk' });
  const publicJwk: Record<string, unknown> = {
    ...exportedPublic,
    kid: TEST_OIDC_KEY_ID,
    alg: 'RS256',
    use: 'sig',
  };

  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  if (typeof privatePem !== 'string') {
    throw new Error('Expected PEM-encoded RSA private key');
  }

  const created: TestKeyPair = {
    publicJwk,
    privatePem,
  };
  cachedKeyPair = created;
  return created;
}

export function testOidcJwksJson(): string {
  return JSON.stringify({ keys: [getTestKeyPair().publicJwk] });
}

export function installOidcTestEnv(): void {
  process.env.OIDC_ISSUER = TEST_OIDC_ISSUER;
  process.env.OIDC_AUDIENCE = TEST_OIDC_AUDIENCE;
  process.env.OIDC_ROLE_CLAIM = TEST_OIDC_ROLE_CLAIM;
  process.env.OIDC_JWKS = testOidcJwksJson();
}

export interface SignTestAccessTokenOptions {
  issuer?: string;
  audience?: string | string[];
  expired?: boolean;
  omitRole?: boolean;
  roleValue?: unknown;
  subject?: string;
}

export async function signTestAccessToken(
  role: DemoRole,
  options: SignTestAccessTokenOptions = {},
): Promise<string> {
  const key = await importPKCS8(getTestKeyPair().privatePem, 'RS256');
  const payload: JWTPayload = {};
  if (options.omitRole !== true) {
    payload[TEST_OIDC_ROLE_CLAIM] = options.roleValue ?? role;
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: TEST_OIDC_KEY_ID })
    .setIssuer(options.issuer ?? TEST_OIDC_ISSUER)
    .setAudience(options.audience ?? TEST_OIDC_AUDIENCE)
    .setSubject(options.subject ?? 'oidc-test-subject')
    .setExpirationTime(options.expired === true ? 0 : '1h')
    .sign(key);
}
