import { type ConfigService } from '@nestjs/config';

import { FindOrCreateCustomerUseCase } from '@/contexts/customers/application/find-or-create-customer.use-case';
import { CreateDeliveryUseCase } from '@/contexts/deliveries/application/create-delivery.use-case';
import { SettleDeliveryUseCase } from '@/contexts/deliveries/application/settle-delivery.use-case';
import { CreateTransactionUseCase } from '@/contexts/payments/application/create-transaction.use-case';
import { GetTransactionUseCase } from '@/contexts/payments/application/get-transaction.use-case';
import { ProcessPaymentUseCase } from '@/contexts/payments/application/process-payment.use-case';
import { SettleTransactionService } from '@/contexts/payments/application/settle-transaction.service';
import { TransactionStatus } from '@/contexts/payments/domain/transaction-status';
import { FakePaymentGateway, StaticReferenceGenerator } from '@test/fakes/fake-payment-gateway';
import {
  buildProduct,
  FakeUnitOfWork,
  FixedClock,
  InMemoryCustomerRepository,
  InMemoryDeliveryRepository,
  InMemoryProductRepository,
  InMemoryTransactionRepository,
  SequentialIdGenerator,
} from '@test/fakes/in-memory-repositories';

import { type CreateTransactionRequest } from './dto/create-transaction.request';
import { type ProcessPaymentRequest } from './dto/process-payment.request';
import { TransactionsController } from './transactions.controller';

const NOW = new Date('2026-07-24T12:00:00.000Z');

const setup = () => {
  const products = new InMemoryProductRepository();
  const customers = new InMemoryCustomerRepository();
  const transactions = new InMemoryTransactionRepository();
  const deliveries = new InMemoryDeliveryRepository();
  const gateway = new FakePaymentGateway();
  const unitOfWork = new FakeUnitOfWork();
  const ids = new SequentialIdGenerator();
  const clock = new FixedClock(NOW);

  products.add(buildProduct());

  const config = {
    getOrThrow: () => ({ baseFeeCents: 500000, deliveryFeeCents: 1000000 }),
  } as unknown as ConfigService;

  const settleTransaction = new SettleTransactionService(
    transactions,
    products,
    clock,
    new SettleDeliveryUseCase(deliveries, clock),
  );

  const controller = new TransactionsController(
    new CreateTransactionUseCase(
      unitOfWork,
      products,
      transactions,
      new StaticReferenceGenerator(),
      ids,
      clock,
      new FindOrCreateCustomerUseCase(customers, ids),
      new CreateDeliveryUseCase(deliveries, ids),
      config,
    ),
    new ProcessPaymentUseCase(unitOfWork, transactions, customers, gateway, settleTransaction),
    new GetTransactionUseCase(unitOfWork, transactions, gateway, settleTransaction),
  );

  return { controller, gateway, products };
};

const createBody = (overrides: Partial<CreateTransactionRequest> = {}): CreateTransactionRequest =>
  ({
    productId: 'product-1',
    quantity: 2,
    customer: {
      email: 'ana.perez@example.com',
      fullName: 'Ana Pérez',
      phoneNumber: '+573001112233',
      legalIdType: 'CC',
      legalIdNumber: '1020304050',
    },
    delivery: {
      recipientName: 'Ana Pérez',
      recipientPhone: '+573001112233',
      addressLine1: 'Calle 123 # 45-67',
      city: 'Medellín',
      region: 'Antioquia',
    },
    ...overrides,
  });

const payBody = (overrides: Partial<ProcessPaymentRequest> = {}): ProcessPaymentRequest =>
  ({
    cardToken: 'tok_test_1234567890',
    acceptanceToken: 'acc_test_1234567890',
    installments: 1,
    cardBrand: 'VISA',
    cardLastFour: '4242',
    ...overrides,
  });

describe('TransactionsController', () => {
  describe('POST /transactions', () => {
    it('returns the reference and the amount breakdown', async () => {
      const { controller } = setup();

      const response = await controller.create(createBody());

      expect(response.reference).toBe('TX-REF-1');
      expect(response.status).toBe(TransactionStatus.PENDING);
      expect(response.amounts).toEqual({
        productAmountInCents: 91980000,
        baseFeeInCents: 500000,
        deliveryFeeInCents: 1000000,
        totalInCents: 93480000,
        currency: 'COP',
      });
    });

    it('does not expose card data before the payment', async () => {
      const { controller } = setup();

      const response = await controller.create(createBody());

      expect(response.cardBrand).toBeNull();
      expect(response.cardLastFour).toBeNull();
      expect(response.completedAt).toBeNull();
    });

    it('answers 404 when the product does not exist', async () => {
      const { controller } = setup();

      await expect(controller.create(createBody({ productId: 'missing' }))).rejects.toMatchObject({
        status: 404,
      });
    });

    it('answers 409 when there is not enough stock', async () => {
      const { controller } = setup();

      await expect(controller.create(createBody({ quantity: 20 }))).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe('POST /transactions/:reference/payment', () => {
    it('returns the approved transaction with the card summary', async () => {
      const { controller } = setup();
      await controller.create(createBody());

      const response = await controller.pay('TX-REF-1', payBody());

      expect(response.status).toBe(TransactionStatus.APPROVED);
      expect(response.cardBrand).toBe('VISA');
      expect(response.cardLastFour).toBe('4242');
      expect(response.completedAt).not.toBeNull();
    });

    it('answers 404 for an unknown reference', async () => {
      const { controller } = setup();

      await expect(controller.pay('TX-MISSING', payBody())).rejects.toMatchObject({ status: 404 });
    });

    it('answers 409 when the transaction already finished', async () => {
      const { controller } = setup();
      await controller.create(createBody());
      await controller.pay('TX-REF-1', payBody());

      await expect(controller.pay('TX-REF-1', payBody())).rejects.toMatchObject({ status: 409 });
    });

    it('answers 400 on a malformed card summary', async () => {
      const { controller } = setup();
      await controller.create(createBody());

      await expect(
        controller.pay('TX-REF-1', payBody({ cardLastFour: '42' })),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('GET /transactions/:reference', () => {
    it('lets the client recover the result after a refresh', async () => {
      const { controller } = setup();
      await controller.create(createBody());
      await controller.pay('TX-REF-1', payBody());

      const response = await controller.findOne('TX-REF-1');

      expect(response.status).toBe(TransactionStatus.APPROVED);
      expect(response.reference).toBe('TX-REF-1');
    });

    it('answers 404 for an unknown reference', async () => {
      const { controller } = setup();

      await expect(controller.findOne('TX-MISSING')).rejects.toMatchObject({ status: 404 });
    });
  });
});
