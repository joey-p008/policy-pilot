import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { DEMO_ACTOR_ID_HEADER, DEMO_PRINCIPALS, DEMO_ROLE_HEADER } from './demo-auth.constants';
import { DemoAuthGuard } from './demo-auth.guard';
import { DEMO_PRINCIPAL_REQUEST_KEY } from './demo-principal.decorator';

function createExecutionContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('DemoAuthGuard', () => {
  it('allows requests when no roles metadata is set', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const guard = new DemoAuthGuard(reflector);
    const request: Record<string, unknown> = { headers: {} };

    expect(guard.canActivate(createExecutionContext(request))).toBe(true);
    expect(request[DEMO_PRINCIPAL_REQUEST_KEY]).toBeUndefined();
  });

  it('rejects missing demo identity headers with 401', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const guard = new DemoAuthGuard(reflector);
    const request: Record<string, unknown> = { headers: {} };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(UnauthorizedException);
  });

  it('rejects mismatched actor id for role with 401', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user']);
    const guard = new DemoAuthGuard(reflector);
    const request: Record<string, unknown> = {
      headers: {
        [DEMO_ROLE_HEADER]: 'user',
        [DEMO_ACTOR_ID_HEADER]: 'admin-123',
      },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(UnauthorizedException);
  });

  it('rejects user role for admin-only routes with 403', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const guard = new DemoAuthGuard(reflector);
    const request: Record<string, unknown> = {
      headers: {
        [DEMO_ROLE_HEADER]: 'user',
        [DEMO_ACTOR_ID_HEADER]: DEMO_PRINCIPALS.user.actorId,
      },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(ForbiddenException);
  });

  it('attaches admin principal when headers and role are valid', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const guard = new DemoAuthGuard(reflector);
    const request: Record<string, unknown> = {
      headers: {
        [DEMO_ROLE_HEADER]: 'admin',
        [DEMO_ACTOR_ID_HEADER]: DEMO_PRINCIPALS.admin.actorId,
      },
    };

    expect(guard.canActivate(createExecutionContext(request))).toBe(true);
    expect(request[DEMO_PRINCIPAL_REQUEST_KEY]).toEqual(DEMO_PRINCIPALS.admin);
  });
});
