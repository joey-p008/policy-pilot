import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { DemoRole } from '@policy-pilot/shared-types';
import { z } from 'zod';

import {
  DEMO_ACTOR_ID_HEADER,
  DEMO_PRINCIPALS,
  DEMO_ROLE_HEADER,
  DEMO_ROLES_KEY,
} from './demo-auth.constants';
import {
  DEMO_PRINCIPAL_REQUEST_KEY,
  type RequestWithDemoPrincipal,
} from './demo-principal.decorator';

const demoRoleSchema = z.enum(['user', 'admin']);

function readHeader(request: RequestWithDemoPrincipal, name: string): string | undefined {
  const value = request.headers[name];
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return undefined;
}

@Injectable()
export class DemoAuthGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const allowedRoles =
      this.reflector.getAllAndOverride<DemoRole[] | undefined>(DEMO_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (allowedRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithDemoPrincipal>();
    const roleHeader = readHeader(request, DEMO_ROLE_HEADER);
    const actorHeader = readHeader(request, DEMO_ACTOR_ID_HEADER);

    if (roleHeader === undefined || actorHeader === undefined) {
      throw new UnauthorizedException(
        `Missing demo identity headers (${DEMO_ROLE_HEADER}, ${DEMO_ACTOR_ID_HEADER})`,
      );
    }

    const roleParsed = demoRoleSchema.safeParse(roleHeader);
    if (!roleParsed.success) {
      throw new UnauthorizedException(`Invalid ${DEMO_ROLE_HEADER}: ${roleHeader}`);
    }

    const role = roleParsed.data;
    const principal = DEMO_PRINCIPALS[role];
    if (principal.actorId !== actorHeader) {
      throw new UnauthorizedException(
        `Demo actor id "${actorHeader}" does not match role "${role}"`,
      );
    }

    if (!allowedRoles.includes(role)) {
      throw new ForbiddenException(`Role "${role}" is not permitted for this action`);
    }

    request[DEMO_PRINCIPAL_REQUEST_KEY] = principal;
    return true;
  }
}
