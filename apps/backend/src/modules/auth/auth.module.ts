import { Global, Module } from '@nestjs/common';

import { JwtAuthGuard } from './jwt-auth.guard';
import { OidcAuthConfig } from './oidc-auth.config';
import { OidcTokenVerifier } from './oidc-token.verifier';

@Global()
@Module({
  providers: [OidcAuthConfig, OidcTokenVerifier, JwtAuthGuard],
  exports: [OidcAuthConfig, OidcTokenVerifier, JwtAuthGuard],
})
export class AuthModule {}
