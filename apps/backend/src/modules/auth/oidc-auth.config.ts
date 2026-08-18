import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JSONWebKeySet } from 'jose';
import { z } from 'zod';

import { DEFAULT_OIDC_ROLE_CLAIM } from './auth.constants';

const jwksSchema = z.object({
  keys: z.array(z.record(z.unknown())).min(1),
});

const oidcEnvSchema = z.object({
  OIDC_ISSUER: z.string().url(),
  OIDC_AUDIENCE: z.string().min(1),
  OIDC_ROLE_CLAIM: z.string().min(1).default(DEFAULT_OIDC_ROLE_CLAIM),
  OIDC_JWKS: z.string().min(1).optional(),
});

export interface OidcAuthSettings {
  issuer: string;
  audience: string;
  roleClaim: string;
  jwks: JSONWebKeySet | undefined;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  return value;
}

function parseJwksJson(raw: string): JSONWebKeySet {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('OIDC_JWKS must be a valid JSON Web Key Set');
  }

  const parsed = jwksSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error('OIDC_JWKS must be a JSON Web Key Set with a non-empty keys array');
  }

  return parsed.data as JSONWebKeySet;
}

@Injectable()
export class OidcAuthConfig {
  public readonly settings: OidcAuthSettings;

  public constructor(configService: ConfigService) {
    const parsed = oidcEnvSchema.parse({
      OIDC_ISSUER: configService.get<string>('OIDC_ISSUER'),
      OIDC_AUDIENCE: configService.get<string>('OIDC_AUDIENCE'),
      OIDC_ROLE_CLAIM: configService.get<string>('OIDC_ROLE_CLAIM') ?? DEFAULT_OIDC_ROLE_CLAIM,
      OIDC_JWKS: emptyToUndefined(configService.get<string>('OIDC_JWKS')),
    });

    this.settings = {
      issuer: parsed.OIDC_ISSUER,
      audience: parsed.OIDC_AUDIENCE,
      roleClaim: parsed.OIDC_ROLE_CLAIM,
      jwks: parsed.OIDC_JWKS === undefined ? undefined : parseJwksJson(parsed.OIDC_JWKS),
    };
  }
}
