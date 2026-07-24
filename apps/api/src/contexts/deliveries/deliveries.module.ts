import { Module } from '@nestjs/common';

import { CreateDeliveryUseCase } from './application/create-delivery.use-case';
import { GetDeliveryUseCase } from './application/get-delivery.use-case';
import { SettleDeliveryUseCase } from './application/settle-delivery.use-case';
import { UpdateDeliveryStatusUseCase } from './application/update-delivery-status.use-case';
import { DELIVERY_REPOSITORY } from './domain/ports/delivery.repository';
import { DeliveriesController } from './infrastructure/http/deliveries.controller';
import { TypeOrmDeliveryRepository } from './infrastructure/persistence/typeorm-delivery.repository';

@Module({
  controllers: [DeliveriesController],
  providers: [
    CreateDeliveryUseCase,
    SettleDeliveryUseCase,
    GetDeliveryUseCase,
    UpdateDeliveryStatusUseCase,
    { provide: DELIVERY_REPOSITORY, useClass: TypeOrmDeliveryRepository },
  ],
  exports: [CreateDeliveryUseCase, SettleDeliveryUseCase, GetDeliveryUseCase],
})
export class DeliveriesModule {}
