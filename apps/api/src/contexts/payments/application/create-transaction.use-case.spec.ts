import { type ConfigService } from '@nestjs/config';

import { FindOrCreateCustomerUseCase } from '@/contexts/customers/application/find-or-create-customer.use-case';
import { CreateDeliveryUseCase } from '@/contexts/deliveries/application/create-delivery.use-case';
import { DeliveryStatus } from '@/contexts/deliveries/domain/delivery';
import { TransactionStatus } from '@/contexts/payments/domain/transaction-status';
import { StaticReferenceGenerator } from '@test/fakes/fake-payment-gateway';
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

import { CreateTransactionUseCase, type CreateTransactionInput } from './create-transaction.use-case';

const NOW = new Date('2026-07-24T12:00:00.000Z');

const setup = () => {
  const products = new InMemoryProductRepository();
  const customers = new InMemoryCustomerRepository();
  const transactions = new InMemoryTransactionRepository();
  const deliveries = new InMemoryDeliveryRepository();
  const unitOfWork = new FakeUnitOfWork();
  const ids = new SequentialIdGenerator();

  products.add(buildProduct());

  const config = {
    getOrThrow: () => ({ baseFeeCents: 500000, deliveryFeeCents: 1000000 }),
  } as unknown as ConfigService;

  const useCase = new CreateTransactionUseCase(
    unitOfWork,
    products,
    transactions,
    new StaticReferenceGenerator(),
    ids,
    new FixedClock(NOW),
    new FindOrCreateCustomerUseCase(customers, ids),
    new CreateDeliveryUseCase(deliveries, ids),
    config,
  );

  return { useCase, products, customers, transactions, deliveries, unitOfWork };
};

const input = (overrides: Partial<CreateTransactionInput> = {}): CreateTransactionInput => ({
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

describe('CreateTransactionUseCase', () => {
  it('creates a pending transaction with the full amount breakdown', async () => {
    const { useCase } = setup();

    const result = await useCase.execute(input());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.status).toBe(TransactionStatus.PENDING);
    expect(result.value.amounts.productAmount.amountInCents).toBe(91980000);
    expect(result.value.amounts.baseFee.amountInCents).toBe(500000);
    expect(result.value.amounts.deliveryFee.amountInCents).toBe(1000000);
    expect(result.value.amounts.total.amountInCents).toBe(93480000);
  });

  it('hands back a transaction reference the client can poll', async () => {
    const { useCase } = setup();

    const result = await useCase.execute(input());

    expect(result.ok && result.value.reference).toBe('TX-REF-1');
  });

  it('moves the purchased units from available to reserved', async () => {
    const { useCase, products } = setup();

    await useCase.execute(input());

    const stock = products.currentStock('product-1');
    expect(stock?.availableUnits).toBe(10);
    expect(stock?.reservedUnits).toBe(2);
  });

  it('registers the buyer', async () => {
    const { useCase, customers } = setup();

    const result = await useCase.execute(input());
    if (!result.ok) throw new Error('expected success');

    const stored = await customers.findById(result.value.customerId);
    expect(stored.ok && stored.value.email.value).toBe('ana.perez@example.com');
  });

  it('reuses an existing buyer instead of duplicating them', async () => {
    const { useCase, customers } = setup();

    const first = await useCase.execute(input());
    const second = await useCase.execute(input());

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.value.customerId).toBe(first.value.customerId);
    const byEmail = await customers.findByEmail('ana.perez@example.com');
    expect(byEmail.ok && byEmail.value).not.toBeNull();
  });

  it('opens a pending delivery for the order', async () => {
    const { useCase, deliveries } = setup();

    const result = await useCase.execute(input());
    if (!result.ok) throw new Error('expected success');

    const delivery = deliveries.current(result.value.id);
    expect(delivery?.status).toBe(DeliveryStatus.PENDING);
    expect(delivery?.address.city).toBe('Medellín');
    expect(delivery?.fee.amountInCents).toBe(1000000);
  });

  it('records the creation in the transaction log', async () => {
    const { useCase, transactions } = setup();

    await useCase.execute(input());

    expect(transactions.events).toHaveLength(1);
    expect(transactions.events[0]).toMatchObject({
      fromStatus: TransactionStatus.PENDING,
      toStatus: TransactionStatus.PENDING,
      source: 'API',
    });
  });

  it('fails when the product does not exist', async () => {
    const { useCase, unitOfWork } = setup();

    const result = await useCase.execute(input({ productId: 'missing' }));

    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error.code).toBe('PRODUCT_NOT_FOUND');
    expect(unitOfWork.rollbacks).toBe(1);
  });

  it('fails when there are not enough units', async () => {
    const { useCase } = setup();

    const result = await useCase.execute(input({ quantity: 20 }));

    expect(result.ok ? null : result.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('leaves the stock untouched when the purchase is rejected', async () => {
    const { useCase, products } = setup();

    await useCase.execute(input({ quantity: 20 }));

    expect(products.currentStock('product-1')?.availableUnits).toBe(12);
  });

  it('fails on invalid buyer details', async () => {
    const { useCase } = setup();

    const result = await useCase.execute(
      input({ customer: { email: 'roto', fullName: 'Ana Pérez', phoneNumber: '+573001112233' } }),
    );

    expect(result.ok ? null : result.error.code).toBe('INVALID_EMAIL');
  });

  it('fails on an incomplete delivery address', async () => {
    const { useCase } = setup();

    const result = await useCase.execute(
      input({
        delivery: {
          recipientName: 'Ana Pérez',
          recipientPhone: '+573001112233',
          addressLine1: '',
          city: 'Medellín',
          region: 'Antioquia',
        },
      }),
    );

    expect(result.ok ? null : result.error.code).toBe('INVALID_DELIVERY_ADDRESS');
  });

  it('propagates a stock write conflict', async () => {
    const { useCase, products } = setup();
    products.failNextStockSave = true;

    const result = await useCase.execute(input());

    expect(result.ok).toBe(false);
  });
});
