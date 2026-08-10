import { Global, Module } from '@nestjs/common';

import { DemoAuthGuard } from './demo-auth.guard';

@Global()
@Module({
  providers: [DemoAuthGuard],
  exports: [DemoAuthGuard],
})
export class AuthModule {}
