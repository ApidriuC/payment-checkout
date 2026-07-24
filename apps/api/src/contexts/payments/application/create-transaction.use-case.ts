import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '@/contexts/catalog/domain/ports/product.repository';
import {
  type CustomerDetails,
  FindOrCreateCustomerUseCase,
} from '@/contexts/customers/application/find-or-create-customer.use-case';
import { CreateDeliveryUseCase } from '@/contexts/deliveries/application/create-delivery.use-case';
import { type DeliveryAddressInput } from '@/contexts/deliveries/domain/delivery';
import { AmountBreakdown } from '@/contexts/payments/domain/amount-breakdown';
import { PaymentTransaction } from '@/contexts/payments/domain/payment-transaction';
import {
  REFERENCE_GENERATOR,
  type ReferenceGenerator,
} from '@/contexts/payments/domain/ports/reference-generator.port';
import {
  TRANSACTION_REPOSITORY,
  TransactionEventSource,
  type TransactionRepository,
} from '@/contexts/payments/domain/ports/transaction.repository';
import { TransactionStatus } from '@/contexts/payments/domain/transaction-status';
import { CLOCK, type Clock } from '@/shared/application/ports/clock.port';
import { type IdGenerator, ID_GENERATOR } from '@/shared/application/ports/id-generator.port';
import {
  type TransactionContext,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@/shared/application/ports/unit-of-work.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { Money } from '@/shared/domain/money';
import { andThen, type AsyncResult, ok, type Result } from '@/shared/domain/result';
import { type FeesConfig } from '@/shared/infrastructure/config/configuration';

export interface CreateTransactionInput {
  productId: string;
  quantity: number;
  customer: CustomerDetails;
  delivery: DeliveryAddressInput;
}

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(REFERENCE_GENERATOR) private readonly references: ReferenceGenerator,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly findOrCreateCustomer: FindOrCreateCustomerUseCase,
    private readonly createDelivery: CreateDeliveryUseCase,
    private readonly config: ConfigService,
  ) {}

  execute(input: CreateTransactionInput): AsyncResult<PaymentTransaction, DomainError> {
    return this.unitOfWork.run((context) => this.reserveAndRegister(input, context));
  }

  private async reserveAndRegister(
    input: CreateTransactionInput,
    context: TransactionContext,
  ): AsyncResult<PaymentTransaction, DomainError> {
    const product = await this.products.findById(input.productId, context);
    if (!product.ok) return product;

    const lockedStock = await this.products.lockStockByProductId(input.productId, context);
    if (!lockedStock.ok) return lockedStock;

    const reserved = lockedStock.value.reserve(input.quantity);
    if (!reserved.ok) return reserved;

    const savedStock = await this.products.saveStock(reserved.value, context);
    if (!savedStock.ok) return savedStock;

    const productAmount = product.value.amountFor(input.quantity);
    if (!productAmount.ok) return productAmount;

    const amounts = this.buildAmounts(productAmount.value);
    if (!amounts.ok) return amounts;

    const customer = await this.findOrCreateCustomer.execute(input.customer, context);
    if (!customer.ok) return customer;

    const transaction = PaymentTransaction.create({
      id: this.ids.generate(),
      reference: this.references.generate(),
      customerId: customer.value.id,
      productId: product.value.id,
      quantity: input.quantity,
      amounts: amounts.value,
      createdAt: this.clock.now(),
    });

    const saved = await this.transactions.save(transaction, context);
    if (!saved.ok) return saved;

    const event = await this.transactions.recordEvent(
      {
        transactionId: transaction.id,
        fromStatus: TransactionStatus.PENDING,
        toStatus: TransactionStatus.PENDING,
        source: TransactionEventSource.API,
      },
      context,
    );
    if (!event.ok) return event;

    const delivery = await this.createDelivery.execute(
      {
        transactionId: transaction.id,
        customerId: customer.value.id,
        address: input.delivery,
        fee: amounts.value.deliveryFee,
      },
      context,
    );
    if (!delivery.ok) return delivery;

    return ok(transaction);
  }

  private buildAmounts(productAmount: Money): Result<AmountBreakdown, DomainError> {
    const fees = this.config.getOrThrow<FeesConfig>('fees');

    return andThen(Money.fromCents(fees.baseFeeCents, productAmount.currency), (baseFee) =>
      andThen(Money.fromCents(fees.deliveryFeeCents, productAmount.currency), (deliveryFee) =>
        AmountBreakdown.create(productAmount, baseFee, deliveryFee),
      ),
    );
  }
}
