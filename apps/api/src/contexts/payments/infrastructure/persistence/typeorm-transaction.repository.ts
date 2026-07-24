import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { TransactionNotFoundError } from '@/contexts/payments/domain/errors';
import { PaymentTransaction } from '@/contexts/payments/domain/payment-transaction';
import {
  type TransactionEventRecord,
  type TransactionRepository,
} from '@/contexts/payments/domain/ports/transaction.repository';
import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError, UnexpectedError } from '@/shared/domain/domain-error';
import { type AsyncResult, err, fromPromise, ok, okVoid, type Result } from '@/shared/domain/result';
import { managerFrom } from '@/shared/infrastructure/persistence/typeorm/typeorm-unit-of-work';

import { TransactionEventOrmEntity } from './transaction-event.orm-entity';
import { TransactionOrmEntity } from './transaction.orm-entity';

@Injectable()
export class TypeOrmTransactionRepository implements TransactionRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findByReference(
    reference: string,
    context?: TransactionContext,
  ): AsyncResult<PaymentTransaction, DomainError> {
    const row = await fromPromise(
      managerFrom(this.dataSource, context)
        .getRepository(TransactionOrmEntity)
        .findOne({ where: { reference } }),
      (cause) => new UnexpectedError('No se pudo consultar la transacción.', cause),
    );

    if (!row.ok) {
      return row;
    }
    if (!row.value) {
      return err(new TransactionNotFoundError(reference));
    }

    return this.toDomain(row.value);
  }

  async lockByReference(
    reference: string,
    context: TransactionContext,
  ): AsyncResult<PaymentTransaction, DomainError> {
    const row = await fromPromise(
      managerFrom(this.dataSource, context)
        .getRepository(TransactionOrmEntity)
        .findOne({ where: { reference }, lock: { mode: 'pessimistic_write' } }),
      (cause) => new UnexpectedError('No se pudo bloquear la transacción.', cause),
    );

    if (!row.ok) {
      return row;
    }
    if (!row.value) {
      return err(new TransactionNotFoundError(reference));
    }

    return this.toDomain(row.value);
  }

  async save(
    transaction: PaymentTransaction,
    context?: TransactionContext,
  ): AsyncResult<PaymentTransaction, DomainError> {
    const snapshot = transaction.toSnapshot();

    const saved = await fromPromise(
      managerFrom(this.dataSource, context)
        .getRepository(TransactionOrmEntity)
        .save({
          id: snapshot.id,
          reference: snapshot.reference,
          customerId: snapshot.customerId,
          productId: snapshot.productId,
          quantity: snapshot.quantity,
          productAmountInCents: snapshot.productAmountInCents,
          baseFeeInCents: snapshot.baseFeeInCents,
          deliveryFeeInCents: snapshot.deliveryFeeInCents,
          totalAmountInCents:
            snapshot.productAmountInCents + snapshot.baseFeeInCents + snapshot.deliveryFeeInCents,
          currency: snapshot.currency,
          status: snapshot.status,
          gatewayTransactionId: snapshot.gatewayTransactionId,
          gatewayStatus: snapshot.gatewayStatus,
          failureReason: snapshot.failureReason,
          cardBrand: snapshot.cardBrand,
          cardLastFour: snapshot.cardLastFour,
          createdAt: snapshot.createdAt,
          completedAt: snapshot.completedAt,
        }),
      (cause) => new UnexpectedError('No se pudo guardar la transacción.', cause),
    );

    if (!saved.ok) {
      return saved;
    }

    return ok(transaction);
  }

  async recordEvent(
    event: TransactionEventRecord,
    context?: TransactionContext,
  ): AsyncResult<void, DomainError> {
    const saved = await fromPromise(
      managerFrom(this.dataSource, context)
        .getRepository(TransactionEventOrmEntity)
        .save({
          transactionId: event.transactionId,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          source: event.source,
          payload: event.payload ?? null,
        }),
      (cause) => new UnexpectedError('No se pudo registrar el evento de la transacción.', cause),
    );

    return saved.ok ? okVoid() : saved;
  }

  private toDomain(row: TransactionOrmEntity): Result<PaymentTransaction, DomainError> {
    return PaymentTransaction.rehydrate({
      id: row.id,
      reference: row.reference,
      customerId: row.customerId,
      productId: row.productId,
      quantity: row.quantity,
      productAmountInCents: row.productAmountInCents,
      baseFeeInCents: row.baseFeeInCents,
      deliveryFeeInCents: row.deliveryFeeInCents,
      currency: row.currency,
      status: row.status,
      gatewayTransactionId: row.gatewayTransactionId,
      gatewayStatus: row.gatewayStatus,
      failureReason: row.failureReason,
      cardBrand: row.cardBrand,
      cardLastFour: row.cardLastFour,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    });
  }
}
