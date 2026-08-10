import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { DemoPrincipal } from './demo-auth.constants';

export const DEMO_PRINCIPAL_REQUEST_KEY = 'demoPrincipal';

export interface RequestWithDemoPrincipal {
  headers: Record<string, string | string[] | undefined>;
  [DEMO_PRINCIPAL_REQUEST_KEY]?: DemoPrincipal;
}

export const DemoPrincipalParam = createParamDecorator(
  (_data: unknown, context: ExecutionContext): DemoPrincipal => {
    const request = context.switchToHttp().getRequest<RequestWithDemoPrincipal>();
    const principal = request[DEMO_PRINCIPAL_REQUEST_KEY];
    if (principal === undefined) {
      throw new Error('DemoPrincipal missing from request; ensure DemoAuthGuard ran first');
    }
    return principal;
  },
);
