import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';

import { CatalogModule } from '@/contexts/catalog/catalog.module';
import { CustomersModule } from '@/contexts/customers/customers.module';
import { DeliveriesModule } from '@/contexts/deliveries/deliveries.module';
import { PaymentsModule } from '@/contexts/payments/payments.module';
import { configurations } from '@/shared/infrastructure/config/configuration';
import { validateEnvironment } from '@/shared/infrastructure/config/env.validation';
import { HealthController } from '@/shared/infrastructure/http/health.controller';
import { PersistenceModule } from '@/shared/infrastructure/persistence/persistence.module';
import { SharedModule } from '@/shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      load: configurations,
      validate: validateEnvironment,
    }),
    PersistenceModule,
    SharedModule,
    TerminusModule,
    CatalogModule,
    CustomersModule,
    DeliveriesModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
