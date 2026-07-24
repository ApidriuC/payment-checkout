import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult } from '@/shared/domain/result';

import { type Delivery } from '../delivery';

export const DELIVERY_REPOSITORY = Symbol('DeliveryRepository');

export interface DeliveryRepository {
  findByTransactionId(
    transactionId: string,
    context?: TransactionContext,
  ): AsyncResult<Delivery, DomainError>;

  save(delivery: Delivery, context?: TransactionContext): AsyncResult<Delivery, DomainError>;
}
