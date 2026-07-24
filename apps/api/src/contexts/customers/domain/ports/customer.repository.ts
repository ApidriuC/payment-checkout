import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult } from '@/shared/domain/result';

import { type Customer } from '../customer';

export const CUSTOMER_REPOSITORY = Symbol('CustomerRepository');

export interface CustomerRepository {
  findById(id: string, context?: TransactionContext): AsyncResult<Customer, DomainError>;

  findByEmail(
    email: string,
    context?: TransactionContext,
  ): AsyncResult<Customer | null, DomainError>;

  save(customer: Customer, context?: TransactionContext): AsyncResult<Customer, DomainError>;
}
