import { Inject, Injectable, Logger } from '@nestjs/common';

import { InvalidWebhookSignatureError } from '@/contexts/payments/domain/errors';
import {
  type GatewayEvent,
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '@/contexts/payments/domain/ports/payment-gateway.port';
import {
  TRANSACTION_REPOSITORY,
  TransactionEventSource,
  type TransactionRepository,
} from '@/contexts/payments/domain/ports/transaction.repository';
import { UNIT_OF_WORK, type UnitOfWork } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult, err, ok } from '@/shared/domain/result';

import { SettleTransactionService } from './settle-transaction.service';

interface EventTransaction {
  id?: string;
  reference?: string;
  status?: string;
  status_message?: string | null;
}

@Injectable()
export class HandleGatewayEventUseCase {
  private readonly logger = new Logger(HandleGatewayEventUseCase.name);

  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly settleTransaction: SettleTransactionService,
  ) {}

  execute(event: GatewayEvent): AsyncResult<void, DomainError> {
    if (!this.gateway.verifyEventSignature(event)) {
      this.logger.warn('Evento descartado: la firma no coincide.');
      return Promise.resolve(err(new InvalidWebhookSignatureError()));
    }

    const payload = (event.data as { transaction?: EventTransaction }).transaction;

    if (!payload?.reference || !payload.status) {
      this.logger.warn('Evento descartado: no contiene referencia o estado.');
      return Promise.resolve(ok(undefined));
    }

    return this.unitOfWork.run(async (context) => {
      const locked = await this.transactions.lockByReference(payload.reference!, context);
      if (!locked.ok) return locked;

      // Webhooks retry and can arrive out of order; a finished transaction is left alone.
      if (locked.value.isFinalized) {
        this.logger.log(`Evento ignorado: ${payload.reference!} ya estaba finalizada.`);
        return ok(undefined);
      }

      const settled = await this.settleTransaction.settle(
        {
          transaction: locked.value,
          outcome: {
            gatewayTransactionId: payload.id ?? locked.value.gatewayTransactionId ?? '',
            gatewayStatus: payload.status!,
            failureReason: payload.status_message ?? null,
          },
          source: TransactionEventSource.GATEWAY_WEBHOOK,
          payload: event.data,
        },
        context,
      );

      if (!settled.ok) return settled;

      return ok(undefined);
    });
  }
}
