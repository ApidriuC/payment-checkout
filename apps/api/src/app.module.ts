import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { configurations } from '@/shared/infrastructure/config/configuration';
import { validateEnvironment } from '@/shared/infrastructure/config/env.validation';
import { HealthController } from '@/shared/infrastructure/http/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      load: configurations,
      validate: validateEnvironment,
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
