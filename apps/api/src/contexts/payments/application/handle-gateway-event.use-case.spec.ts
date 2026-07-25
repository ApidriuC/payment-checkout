import { SettleDeliveryUseCase } from '@/contexts/deliveries/application/settle-delivery.use-case';
import { Delivery, DeliveryAddress, DeliveryStatus } from '@/contexts/deliveries/domain/delivery';
import { AmountBreakdown } from '@/contexts/payments/domain/amount-breakdown';
import { PaymentTransaction } from '@/contexts/payments/domain/payment-transaction';
import { type GatewayEvent } from '@/contexts/payments/domain/ports/payment-gateway.port';
import { TransactionEventSource } from '@/contexts/payments/domain/ports/transaction.repository';
import { TransactionStatus } from '@/contexts/payments/domain/transaction-status';
import { Money } from '@/shared/domain/money';
import { FakePaymentGateway } from '@test/fakes/fake-payment-gateway';
import {
  buildProduct,
  FakeUnitOfWork,
  FixedClock,
  InMemoryDeliveryRepository,
  InMemoryProductRepository,
  InMemoryTransactionRepository,
} from '@test/fakes/in-memory-repositories';

import { HandleGatewayEventUseCase } from './handle-gateway-event.use-case';
import { SettleTransactionService } from './settle-transaction.service';

const NOW = new Date('2026-07-24T12:00:05.000Z');

const money = (cents: number): Money => {
  const result = Money.fromCents(cents);
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const setup = () => {
  const products = new InMemoryProductRepository();
  const transactions = new InMemoryTransactionRepository();
  const deliveries = new InMemoryDeliveryRepository();
  const gateway = new FakePaymentGateway();

  products.add(buildProduct({ stock: { availableUnits: 10, reservedUnits: 2, version: 1 } }));

  const breakdown = AmountBreakdown.create(money(91980000), money(500000), money(1000000));
  if (!breakdown.ok) throw new Error('fixture');

  transactions.add(
    PaymentTransaction.create({
      id: 'transaction-1',
      reference: 'TX-REF-1',
      customerId: 'customer-1',
      productId: 'product-1',
      quantity: 2,
      amounts: breakdown.value,
      createdAt: new Date('2026-07-24T12:00:00.000Z'),
    }),
  );

  const address = DeliveryAddress.create({
    recipientName: 'Ana Pérez',
    recipientPhone: '+573001112233',
    addressLine1: 'Calle 123 # 45-67',
    city: 'Medellín',
    region: 'Antioquia',
  });
  if (!address.ok) throw new Error('fixture');

  deliveries.add(
    Delivery.create({
      id: 'delivery-1',
      transactionId: 'transaction-1',
      customerId: 'customer-1',
      address: address.value,
      fee: money(1000000),
    }),
  );

  const clock = new FixedClock(NOW);
  const useCase = new HandleGatewayEventUseCase(
    new FakeUnitOfWork(),
    transactions,
    gateway,
    new SettleTransactionService(
      transactions,
      products,
      clock,
      new SettleDeliveryUseCase(deliveries, clock),
    ),
  );

  return { useCase, gateway, products, transactions, deliveries };
};

const event = (overrides: Partial<Record<string, unknown>> = {}): GatewayEvent => ({
  event: 'transaction.updated',
  data: {
    transaction: {
      id: 'gw-1',
      reference: 'TX-REF-1',
      status: 'APPROVED',
      status_message: null,
      ...overrides,
    },
  },
  timestamp: 1784926800,
  signature: { properties: ['transaction.id', 'transaction.status'], checksum: 'abc' },
});

describe('HandleGatewayEventUseCase', () => {
  it('applies an approved event to the transaction', async () => {
    const { useCase, transactions } = setup();

    const result = await useCase.execute(event());

    expect(result.ok).toBe(true);
    expect(transactions.current('TX-REF-1')?.status).toBe(TransactionStatus.APPROVED);
  });

  it('settles stock and delivery from the event', async () => {
    const { useCase, products, deliveries } = setup();

    await useCase.execute(event());

    expect(products.currentStock('product-1')?.reservedUnits).toBe(0);
    expect(deliveries.current('transaction-1')?.status).toBe(DeliveryStatus.ASSIGNED);
  });

  it('marks the event source so the log distinguishes it from a client call', async () => {
    const { useCase, transactions } = setup();

    await useCase.execute(event());

    expect(transactions.events[0].source).toBe(TransactionEventSource.GATEWAY_WEBHOOK);
  });

  it('rejects an event whose signature does not verify', async () => {
    const { useCase, gateway, transactions } = setup();
    gateway.signatureValid = false;

    const result = await useCase.execute(event());

    expect(result.ok ? null : result.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
    expect(transactions.current('TX-REF-1')?.status).toBe(TransactionStatus.PENDING);
  });

  it('ignores a duplicate event for an already finalized transaction', async () => {
    const { useCase, products } = setup();

    await useCase.execute(event());
    const second = await useCase.execute(event({ status: 'DECLINED' }));

    expect(second.ok).toBe(true);
    // The units stayed consumed: the late DECLINED did not hand them back.
    expect(products.currentStock('product-1')?.availableUnits).toBe(10);
  });

  it('accepts an event without a matching transaction body without failing', async () => {
    const { useCase } = setup();

    const result = await useCase.execute({ ...event(), data: {} });

    expect(result.ok).toBe(true);
  });

  it('ignores an event missing the status', async () => {
    const { useCase, transactions } = setup();

    const result = await useCase.execute({
      ...event(),
      data: { transaction: { id: 'gw-1', reference: 'TX-REF-1' } },
    });

    expect(result.ok).toBe(true);
    expect(transactions.current('TX-REF-1')?.status).toBe(TransactionStatus.PENDING);
  });

  it('fails when the referenced transaction is unknown', async () => {
    const { useCase } = setup();

    const result = await useCase.execute(event({ reference: 'TX-MISSING' }));

    expect(result.ok ? null : result.error.code).toBe('TRANSACTION_NOT_FOUND');
  });

  it('releases the units when the event reports a decline', async () => {
    const { useCase, products, deliveries } = setup();

    await useCase.execute(event({ status: 'DECLINED', status_message: 'Rechazada por el banco' }));

    expect(products.currentStock('product-1')?.availableUnits).toBe(12);
    expect(deliveries.current('transaction-1')?.status).toBe(DeliveryStatus.CANCELLED);
  });
});
