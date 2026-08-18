import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthPrincipal } from './auth.constants';

export const AUTH_PRINCIPAL_REQUEST_KEY = 'authPrincipal';

export interface RequestWithAuthPrincipal {
  headers: Record<string, string | string[] | undefined>;
  [AUTH_PRINCIPAL_REQUEST_KEY]?: AuthPrincipal;
}

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal => {
    const request = context.switchToHttp().getRequest<RequestWithAuthPrincipal>();
    const principal = request[AUTH_PRINCIPAL_REQUEST_KEY];
    if (principal === undefined) {
      throw new Error('AuthPrincipal missing from request; ensure JwtAuthGuard ran first');
    }
    return principal;
  },
);
