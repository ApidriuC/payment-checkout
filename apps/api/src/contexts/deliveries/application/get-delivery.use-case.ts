import { Inject, Injectable } from '@nestjs/common';

import { type Delivery } from '@/contexts/deliveries/domain/delivery';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepository,
} from '@/contexts/deliveries/domain/ports/delivery.repository';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult } from '@/shared/domain/result';

@Injectable()
export class GetDeliveryUseCase {
  constructor(@Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository) {}

  execute(transactionId: string): AsyncResult<Delivery, DomainError> {
    return this.deliveries.findByTransactionId(transactionId);
  }
}
