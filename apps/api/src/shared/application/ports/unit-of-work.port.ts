import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult } from '@/shared/domain/result';

// Opaque handle: use cases pass it between repositories to keep every write in the
// same database transaction, without knowing what the persistence adapter put in it.
export interface TransactionContext {
  readonly __transactionContext: unique symbol;
}

export const UNIT_OF_WORK = Symbol('UnitOfWork');

export interface UnitOfWork {
  run<T>(
    work: (context: TransactionContext) => AsyncResult<T, DomainError>,
  ): AsyncResult<T, DomainError>;
}
