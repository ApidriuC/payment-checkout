import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult } from '@/shared/domain/result';

import { type PaymentTransaction } from '../payment-transaction';
import { type TransactionStatus } from '../transaction-status';

export const TRANSACTION_REPOSITORY = Symbol('TransactionRepository');

export enum TransactionEventSource {
  API = 'API',
  GATEWAY_WEBHOOK = 'GATEWAY_WEBHOOK',
}

export interface TransactionEventRecord {
  transactionId: string;
  fromStatus: TransactionStatus;
  toStatus: TransactionStatus;
  source: TransactionEventSource;
  payload?: Record<string, unknown> | null;
}

export interface TransactionRepository {
  findByReference(
    reference: string,
    context?: TransactionContext,
  ): AsyncResult<PaymentTransaction, DomainError>;

  /** Locks the row so a webhook and a client poll cannot finalize it twice. */
  lockByReference(
    reference: string,
    context: TransactionContext,
  ): AsyncResult<PaymentTransaction, DomainError>;

  save(
    transaction: PaymentTransaction,
    context?: TransactionContext,
  ): AsyncResult<PaymentTransaction, DomainError>;

  recordEvent(event: TransactionEventRecord, context?: TransactionContext): AsyncResult<void, DomainError>;
}
