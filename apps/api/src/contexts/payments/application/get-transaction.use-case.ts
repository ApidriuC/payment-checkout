import { Inject, Injectable, Logger } from '@nestjs/common';

import { type PaymentTransaction } from '@/contexts/payments/domain/payment-transaction';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '@/contexts/payments/domain/ports/payment-gateway.port';
import {
  TRANSACTION_REPOSITORY,
  TransactionEventSource,
  type TransactionRepository,
} from '@/contexts/payments/domain/ports/transaction.repository';
import { TransactionStatus } from '@/contexts/payments/domain/transaction-status';
import { UNIT_OF_WORK, type UnitOfWork } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult } from '@/shared/domain/result';

import { SettleTransactionService } from './settle-transaction.service';

/**
 * Reading a transaction also reconciles it. Card payments settle asynchronously,
 * so a webhook may never arrive (unreachable host, lost delivery). Polling this
 * endpoint asks the gateway for the current status and finalizes the transaction,
 * which is what keeps stock from staying reserved forever.
 */
@Injectable()
export class GetTransactionUseCase {
  private readonly logger = new Logger(GetTransactionUseCase.name);

  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly settleTransaction: SettleTransactionService,
  ) {}

  async execute(reference: string): AsyncResult<PaymentTransaction, DomainError> {
    const found = await this.transactions.findByReference(reference);
    if (!found.ok) return found;

    if (found.value.isFinalized || !found.value.gatewayTransactionId) {
      return found;
    }

    const charge = await this.gateway.findCharge(found.value.gatewayTransactionId);

    // A gateway hiccup must not turn a status read into an error; the client
    // simply sees the transaction still pending and can retry.
    if (!charge.ok) {
      this.logger.warn(`No se pudo reconciliar ${reference}: ${charge.error.code}`);
      return found;
    }

    if (charge.value.gatewayStatus.trim().toUpperCase() === String(TransactionStatus.PENDING)) {
      return found;
    }

    return this.unitOfWork.run(async (context) => {
      const locked = await this.transactions.lockByReference(reference, context);
      if (!locked.ok) return locked;

      // A webhook may have settled it between the read and the lock.
      if (locked.value.isFinalized) {
        return locked;
      }

      return this.settleTransaction.settle(
        {
          transaction: locked.value,
          outcome: charge.value,
          source: TransactionEventSource.API,
        },
        context,
      );
    });
  }
}
