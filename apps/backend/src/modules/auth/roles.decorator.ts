import { SetMetadata } from '@nestjs/common';
import type { DemoRole } from '@policy-pilot/shared-types';

import { DEMO_ROLES_KEY } from './demo-auth.constants';

export function Roles(...roles: DemoRole[]): ReturnType<typeof SetMetadata> {
  return SetMetadata(DEMO_ROLES_KEY, roles);
}
