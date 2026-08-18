import { ConfigService } from '@nestjs/config';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AUTH_PRINCIPALS } from './auth.constants';
import { AUTH_PRINCIPAL_REQUEST_KEY } from './current-principal.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OidcAuthConfig } from './oidc-auth.config';
import { OidcTokenVerifier } from './oidc-token.verifier';
import { installOidcTestEnv, signTestAccessToken } from '../../../test/oidc-test-keys';

installOidcTestEnv();

function createExecutionContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function buildGuard(reflector: Reflector): JwtAuthGuard {
  const configService = {
    get: (key: string): string | undefined => process.env[key],
  } as Pick<ConfigService, 'get'>;
  const oidcAuthConfig = new OidcAuthConfig(configService as ConfigService);
  const verifier = new OidcTokenVerifier(oidcAuthConfig);
  return new JwtAuthGuard(reflector, verifier, oidcAuthConfig);
}

describe('JwtAuthGuard', () => {
  it('allows requests when no roles metadata is set', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const guard = buildGuard(reflector);
    const request: Record<string, unknown> = { headers: {} };

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect(request[AUTH_PRINCIPAL_REQUEST_KEY]).toBeUndefined();
  });

  it('rejects missing bearer tokens with 401', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const guard = buildGuard(reflector);
    const request: Record<string, unknown> = { headers: {} };

    await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects malformed authorization headers with 401', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user']);
    const guard = buildGuard(reflector);
    const request: Record<string, unknown> = {
      headers: { authorization: 'Basic abc' },
    };

    await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects tokens with the wrong audience with 401', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const guard = buildGuard(reflector);
    const token = await signTestAccessToken('admin', { audience: 'other-api' });
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };

    await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects tokens with the wrong issuer with 401', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const guard = buildGuard(reflector);
    const token = await signTestAccessToken('admin', { issuer: 'http://localhost/other' });
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };

    await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects user role for admin-only routes with 403', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const guard = buildGuard(reflector);
    const token = await signTestAccessToken('user');
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };

    await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('attaches the admin principal when the JWT role claim is valid', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const guard = buildGuard(reflector);
    const token = await signTestAccessToken('admin');
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect(request[AUTH_PRINCIPAL_REQUEST_KEY]).toEqual(AUTH_PRINCIPALS.admin);
  });

  it('accepts a role claim array that includes admin', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const guard = buildGuard(reflector);
    const token = await signTestAccessToken('admin', { roleValue: ['user', 'admin'] });
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` },
    };

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect(request[AUTH_PRINCIPAL_REQUEST_KEY]).toEqual(AUTH_PRINCIPALS.admin);
  });
});
