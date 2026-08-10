import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';
import { AccessAuditLogRepository } from './repositories/access-audit-log.repository';
import { AccessRequestRepository } from './repositories/access-request.repository';
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
    AccessRequestRepository,
    PolicyChunkRepository,
  ],
  exports: [
    PrismaService,
    UserRepository,
    EntitlementRepository,
    IdempotencyKeyRepository,
    AccessAuditLogRepository,
    AccessRequestRepository,
    PolicyChunkRepository,
  ],
})
export class DatabaseModule {}
