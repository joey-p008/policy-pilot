import { existsSync } from 'node:fs';

import { Module, type DynamicModule, type Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccessRequestsModule } from './modules/access-requests/access-requests.module';
import { AiModule } from './modules/ai/ai.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './modules/database/database.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { QueueModule } from './modules/queue/queue.module';

function buildFrontendStaticImports(): Array<DynamicModule | Type<unknown>> {
  const frontendDistPath = process.env.FRONTEND_DIST_PATH;
  if (typeof frontendDistPath !== 'string' || frontendDistPath.length === 0) {
    return [];
  }

  if (!existsSync(frontendDistPath)) {
    return [];
  }

  return [
    ServeStaticModule.forRoot({
      rootPath: frontendDistPath,
      exclude: ['/health', '/access-requests/(.*)', '/webhooks/(.*)'],
    }),
  ];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ...buildFrontendStaticImports(),
    DatabaseModule,
    QueueModule,
    IdempotencyModule,
    AuditLogModule,
    AuthModule,
    AccessRequestsModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
