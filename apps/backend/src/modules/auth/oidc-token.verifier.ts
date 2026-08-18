import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import { z } from 'zod';

import { OidcAuthConfig } from './oidc-auth.config';

function issuerDiscoveryUrl(issuer: string): URL {
  const base = issuer.endsWith('/') ? issuer : `${issuer}/`;
  return new URL('.well-known/openid-configuration', base);
}

const openIdConfigurationSchema = z.object({
  jwks_uri: z.string().url(),
});

@Injectable()
export class OidcTokenVerifier {
  private getKey: JWTVerifyGetKey | undefined;

  public constructor(private readonly oidcAuthConfig: OidcAuthConfig) {}

  public async verifyAccessToken(token: string): Promise<JWTPayload> {
    const getKey = await this.resolveGetKey();

    try {
      const { payload } = await jwtVerify(token, getKey, {
        issuer: this.oidcAuthConfig.settings.issuer,
        audience: this.oidcAuthConfig.settings.audience,
        clockTolerance: 5,
      });
      return payload;
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }
  }

  private async resolveGetKey(): Promise<JWTVerifyGetKey> {
    if (this.getKey !== undefined) {
      return this.getKey;
    }

    const localJwks: JSONWebKeySet | undefined = this.oidcAuthConfig.settings.jwks;

    if (localJwks !== undefined) {
      this.getKey = createLocalJWKSet(localJwks);
      return this.getKey;
    }

    const discoveryResponse = await fetch(issuerDiscoveryUrl(this.oidcAuthConfig.settings.issuer));
    if (!discoveryResponse.ok) {
      throw new UnauthorizedException('Unauthorized');
    }

    const discoveryJson: unknown = await discoveryResponse.json();
    const discoveryParsed = openIdConfigurationSchema.safeParse(discoveryJson);
    if (!discoveryParsed.success) {
      throw new UnauthorizedException('Unauthorized');
    }
    const { jwks_uri: jwksUri } = discoveryParsed.data;
    this.getKey = createRemoteJWKSet(new URL(jwksUri));
    return this.getKey;
  }
}
