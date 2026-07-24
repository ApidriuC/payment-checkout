import { Inject, Injectable } from '@nestjs/common';

import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '@/contexts/catalog/domain/ports/product.repository';
import { SettleDeliveryUseCase } from '@/contexts/deliveries/application/settle-delivery.use-case';
import {
  type GatewayOutcome,
  type PaymentTransaction,
} from '@/contexts/payments/domain/payment-transaction';
import {
  TRANSACTION_REPOSITORY,
  type TransactionEventSource,
  type TransactionRepository,
} from '@/contexts/payments/domain/ports/transaction.repository';
import { releasesStock, TransactionStatus } from '@/contexts/payments/domain/transaction-status';
import { CLOCK, type Clock } from '@/shared/application/ports/clock.port';
import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult, ok } from '@/shared/domain/result';

export interface SettleInput {
  transaction: PaymentTransaction;
  outcome: GatewayOutcome;
  source: TransactionEventSource;
  payload?: Record<string, unknown> | null;
}

/**
 * Single place where a gateway result becomes durable state: transaction status,
 * stock settlement and delivery assignment always move together.
 */
@Injectable()
export class SettleTransactionService {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly settleDelivery: SettleDeliveryUseCase,
  ) {}

  async settle(
    input: SettleInput,
    context: TransactionContext,
  ): AsyncResult<PaymentTransaction, DomainError> {
    const previousStatus = input.transaction.status;

    const updated = input.transaction.applyGatewayOutcome(input.outcome, this.clock.now());
    if (!updated.ok) return updated;

    const saved = await this.transactions.save(updated.value, context);
    if (!saved.ok) return saved;

    const event = await this.transactions.recordEvent(
      {
        transactionId: updated.value.id,
        fromStatus: previousStatus,
        toStatus: updated.value.status,
        source: input.source,
        payload: input.payload ?? null,
      },
      context,
    );
    if (!event.ok) return event;

    const stock = await this.settleStock(updated.value, context);
    if (!stock.ok) return stock;

    const delivery = await this.settleDeliveryFor(updated.value, context);
    if (!delivery.ok) return delivery;

    return ok(updated.value);
  }

  private async settleStock(
    transaction: PaymentTransaction,
    context: TransactionContext,
  ): AsyncResult<void, DomainError> {
    if (transaction.status === TransactionStatus.PENDING) {
      return ok(undefined);
    }

    const locked = await this.products.lockStockByProductId(transaction.productId, context);
    if (!locked.ok) return locked;

    const settled = releasesStock(transaction.status)
      ? locked.value.releaseReservation(transaction.quantity)
      : locked.value.confirmReservation(transaction.quantity);
    if (!settled.ok) return settled;

    const saved = await this.products.saveStock(settled.value, context);
    if (!saved.ok) return saved;

    return ok(undefined);
  }

  private async settleDeliveryFor(
    transaction: PaymentTransaction,
    context: TransactionContext,
  ): AsyncResult<void, DomainError> {
    if (transaction.status === TransactionStatus.PENDING) {
      return ok(undefined);
    }

    const result =
      transaction.status === TransactionStatus.APPROVED
        ? await this.settleDelivery.assign(transaction.id, transaction.reference, context)
        : await this.settleDelivery.cancel(transaction.id, context);

    if (!result.ok) return result;

    return ok(undefined);
  }
}
