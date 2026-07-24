import { Inject, Injectable } from '@nestjs/common';

import { type Delivery, type DeliveryStatus } from '@/contexts/deliveries/domain/delivery';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepository,
} from '@/contexts/deliveries/domain/ports/delivery.repository';
import { type DomainError } from '@/shared/domain/domain-error';
import { andThenAsync, type AsyncResult } from '@/shared/domain/result';

@Injectable()
export class UpdateDeliveryStatusUseCase {
  constructor(@Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository) {}

  async execute(transactionId: string, status: DeliveryStatus): AsyncResult<Delivery, DomainError> {
    const found = await this.deliveries.findByTransactionId(transactionId);

    return andThenAsync(found, (delivery) =>
      andThenAsync(delivery.markAs(status), (updated) => this.deliveries.save(updated)),
    );
  }
}
