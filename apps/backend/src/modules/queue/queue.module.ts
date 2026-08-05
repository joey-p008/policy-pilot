import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const portValue = configService.get<string>('REDIS_PORT');
        const port = portValue === undefined ? 6379 : Number(portValue);

        return {
          connection: {
            host: configService.get<string>('REDIS_HOST') ?? 'localhost',
            port: Number.isFinite(port) ? port : 6379,
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
