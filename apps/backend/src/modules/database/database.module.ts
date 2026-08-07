import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';
import { AccessAuditLogRepository } from './repositories/access-audit-log.repository';
import { EntitlementRepository } from './repositories/entitlement.repository';
import { IdempotencyKeyRepository } from './repositories/idempotency-key.repository';
import { PolicyChunkRepository } from './repositories/policy-chunk.repository';
import { UserRepository } from './repositories/user.repository';

@Global()
@Module({
  providers: [
    PrismaService,
    UserRepository,
    EntitlementRepository,
    IdempotencyKeyRepository,
    AccessAuditLogRepository,
    PolicyChunkRepository,
  ],
  exports: [
    PrismaService,
    UserRepository,
    EntitlementRepository,
    IdempotencyKeyRepository,
    AccessAuditLogRepository,
    PolicyChunkRepository,
  ],
})
export class DatabaseModule {}
