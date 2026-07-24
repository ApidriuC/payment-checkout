import { Inject, Injectable } from '@nestjs/common';

import { type Delivery } from '@/contexts/deliveries/domain/delivery';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepository,
} from '@/contexts/deliveries/domain/ports/delivery.repository';
import { CLOCK, type Clock } from '@/shared/application/ports/clock.port';
import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { andThenAsync, type AsyncResult } from '@/shared/domain/result';

@Injectable()
export class SettleDeliveryUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  assign(
    transactionId: string,
    trackingCode: string,
    context?: TransactionContext,
  ): AsyncResult<Delivery, DomainError> {
    return this.transition(transactionId, context, (delivery) =>
      delivery.assign(trackingCode, this.clock.now()),
    );
  }

  cancel(transactionId: string, context?: TransactionContext): AsyncResult<Delivery, DomainError> {
    return this.transition(transactionId, context, (delivery) => delivery.cancel());
  }

  private async transition(
    transactionId: string,
    context: TransactionContext | undefined,
    apply: (delivery: Delivery) => ReturnType<Delivery['cancel']>,
  ): AsyncResult<Delivery, DomainError> {
    const found = await this.deliveries.findByTransactionId(transactionId, context);

    return andThenAsync(found, (delivery) =>
      andThenAsync(apply(delivery), (updated) => this.deliveries.save(updated, context)),
    );
  }
}
