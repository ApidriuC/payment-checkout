import { Inject, Injectable, Logger } from '@nestjs/common';

import { CardSummary } from '@/contexts/payments/domain/card-summary';
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
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from '@/contexts/customers/domain/ports/customer.repository';
import { UNIT_OF_WORK, type UnitOfWork } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult } from '@/shared/domain/result';

import { SettleTransactionService } from './settle-transaction.service';

export interface ProcessPaymentInput {
  reference: string;
  cardToken: string;
  acceptanceToken: string;
  personalDataAuthToken?: string | null;
  installments: number;
  cardBrand: string;
  cardLastFour: string;
}

@Injectable()
export class ProcessPaymentUseCase {
  private readonly logger = new Logger(ProcessPaymentUseCase.name);

  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly settleTransaction: SettleTransactionService,
  ) {}

  async execute(input: ProcessPaymentInput): AsyncResult<PaymentTransaction, DomainError> {
    const prepared = await this.attachCard(input);
    if (!prepared.ok) return prepared;

    const customer = await this.customers.findById(prepared.value.customerId);
    if (!customer.ok) return customer;

    // The network call stays outside any database transaction so a slow gateway
    // never holds a row lock open.
    const charge = await this.gateway.charge({
      reference: prepared.value.reference,
      amountInCents: prepared.value.amounts.total.amountInCents,
      currency: prepared.value.amounts.currency,
      customerEmail: customer.value.email.value,
      cardToken: input.cardToken,
      acceptanceToken: input.acceptanceToken,
      personalDataAuthToken: input.personalDataAuthToken ?? null,
      installments: input.installments,
    });

    if (!charge.ok) {
      this.logger.warn(
        `Pago ${prepared.value.reference} no pudo enviarse a la pasarela: ${charge.error.code}`,
      );
      return this.abandon(input.reference, charge.error.message);
    }

    return this.unitOfWork.run(async (context) => {
      const locked = await this.transactions.lockByReference(input.reference, context);
      if (!locked.ok) return locked;

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

  private attachCard(input: ProcessPaymentInput): AsyncResult<PaymentTransaction, DomainError> {
    return this.unitOfWork.run(async (context) => {
      const locked = await this.transactions.lockByReference(input.reference, context);
      if (!locked.ok) return locked;

      const card = CardSummary.create(input.cardBrand, input.cardLastFour);
      if (!card.ok) return card;

      const withCard = locked.value.withCard(card.value);
      if (!withCard.ok) return withCard;

      return this.transactions.save(withCard.value, context);
    });
  }

  /** The charge never reached a final state: fail the transaction and give the units back. */
  private abandon(reference: string, reason: string): AsyncResult<PaymentTransaction, DomainError> {
    return this.unitOfWork.run(async (context) => {
      const locked = await this.transactions.lockByReference(reference, context);
      if (!locked.ok) return locked;

      return this.settleTransaction.settle(
        {
          transaction: locked.value,
          outcome: {
            gatewayTransactionId: locked.value.gatewayTransactionId ?? '',
            gatewayStatus: 'ERROR',
            failureReason: reason,
          },
          source: TransactionEventSource.API,
        },
        context,
      );
    });
  }
}
