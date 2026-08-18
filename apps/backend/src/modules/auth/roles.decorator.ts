import { SetMetadata } from '@nestjs/common';
import type { DemoRole } from '@policy-pilot/shared-types';

import { ROLES_KEY } from './auth.constants';

export function Roles(...roles: DemoRole[]): ReturnType<typeof SetMetadata> {
  return SetMetadata(ROLES_KEY, roles);
}
