import { Inject, Injectable } from '@nestjs/common';

import {
  Delivery,
  DeliveryAddress,
  type DeliveryAddressInput,
} from '@/contexts/deliveries/domain/delivery';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepository,
} from '@/contexts/deliveries/domain/ports/delivery.repository';
import { type IdGenerator, ID_GENERATOR } from '@/shared/application/ports/id-generator.port';
import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { type Money } from '@/shared/domain/money';
import { andThenAsync, type AsyncResult } from '@/shared/domain/result';

export interface CreateDeliveryInput {
  transactionId: string;
  customerId: string;
  address: DeliveryAddressInput;
  fee: Money;
}

@Injectable()
export class CreateDeliveryUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(input: CreateDeliveryInput, context?: TransactionContext): AsyncResult<Delivery, DomainError> {
    return andThenAsync(DeliveryAddress.create(input.address), (address) =>
      this.deliveries.save(
        Delivery.create({
          id: this.ids.generate(),
          transactionId: input.transactionId,
          customerId: input.customerId,
          address,
          fee: input.fee,
        }),
        context,
      ),
    );
  }
}
