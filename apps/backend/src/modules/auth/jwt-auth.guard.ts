import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { DemoRole } from '@policy-pilot/shared-types';
import type { JWTPayload } from 'jose';

import { AUTH_PRINCIPALS, ROLES_KEY } from './auth.constants';
import {
  AUTH_PRINCIPAL_REQUEST_KEY,
  type RequestWithAuthPrincipal,
} from './current-principal.decorator';
import { OidcAuthConfig } from './oidc-auth.config';
import { parseOidcRoleClaim } from './oidc-roles';
import { OidcTokenVerifier } from './oidc-token.verifier';

function readAuthorizationHeader(request: RequestWithAuthPrincipal): string | undefined {
  const value = request.headers.authorization;
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return undefined;
}

function extractBearerToken(authorization: string | undefined): string {
  if (authorization === undefined) {
    throw new UnauthorizedException('Unauthorized');
  }

  const prefix = 'Bearer ';
  if (!authorization.startsWith(prefix) || authorization.length <= prefix.length) {
    throw new UnauthorizedException('Unauthorized');
  }

  return authorization.slice(prefix.length);
}

function roleFromPayload(payload: JWTPayload, roleClaim: string): DemoRole {
  const role = parseOidcRoleClaim(payload[roleClaim]);
  if (role === undefined) {
    throw new UnauthorizedException('Unauthorized');
  }
  return role;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    private readonly oidcTokenVerifier: OidcTokenVerifier,
    private readonly oidcAuthConfig: OidcAuthConfig,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowedRoles =
      this.reflector.getAllAndOverride<DemoRole[] | undefined>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (allowedRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuthPrincipal>();
    const token = extractBearerToken(readAuthorizationHeader(request));
    const payload = await this.oidcTokenVerifier.verifyAccessToken(token);
    const role = roleFromPayload(payload, this.oidcAuthConfig.settings.roleClaim);

    if (!allowedRoles.includes(role)) {
      throw new ForbiddenException('Forbidden');
    }

    request[AUTH_PRINCIPAL_REQUEST_KEY] = AUTH_PRINCIPALS[role];
    return true;
  }
}
