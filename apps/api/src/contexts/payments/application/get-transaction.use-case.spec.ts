import { SettleDeliveryUseCase } from '@/contexts/deliveries/application/settle-delivery.use-case';
import { Delivery, DeliveryAddress, DeliveryStatus } from '@/contexts/deliveries/domain/delivery';
import { AmountBreakdown } from '@/contexts/payments/domain/amount-breakdown';
import { PaymentTransaction } from '@/contexts/payments/domain/payment-transaction';
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

import { GetTransactionUseCase } from './get-transaction.use-case';
import { SettleTransactionService } from './settle-transaction.service';

const NOW = new Date('2026-07-24T12:00:05.000Z');

const money = (cents: number): Money => {
  const result = Money.fromCents(cents);
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const setup = (options: { withGatewayId?: boolean } = {}) => {
  const products = new InMemoryProductRepository();
  const transactions = new InMemoryTransactionRepository();
  const deliveries = new InMemoryDeliveryRepository();
  const gateway = new FakePaymentGateway();

  products.add(buildProduct({ stock: { availableUnits: 10, reservedUnits: 2, version: 1 } }));

  const breakdown = AmountBreakdown.create(money(91980000), money(500000), money(1000000));
  if (!breakdown.ok) throw new Error('fixture');

  let transaction = PaymentTransaction.create({
    id: 'transaction-1',
    reference: 'TX-REF-1',
    customerId: 'customer-1',
    productId: 'product-1',
    quantity: 2,
    amounts: breakdown.value,
    createdAt: new Date('2026-07-24T12:00:00.000Z'),
  });

  if (options.withGatewayId !== false) {
    const sent = transaction.applyGatewayOutcome(
      { gatewayTransactionId: 'gw-1', gatewayStatus: 'PENDING' },
      NOW,
    );
    if (!sent.ok) throw new Error('fixture');
    transaction = sent.value;
  }

  transactions.add(transaction);

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
  const useCase = new GetTransactionUseCase(
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

describe('GetTransactionUseCase', () => {
  it('fails when the reference does not exist', async () => {
    const { useCase } = setup();

    const result = await useCase.execute('TX-MISSING');

    expect(result.ok ? null : result.error.code).toBe('TRANSACTION_NOT_FOUND');
  });

  it('finalizes a pending transaction the gateway has already approved', async () => {
    const { useCase, gateway, products, deliveries } = setup();
    gateway.findResult = { gatewayTransactionId: 'gw-1', gatewayStatus: 'APPROVED' };

    const result = await useCase.execute('TX-REF-1');

    expect(result.ok && result.value.status).toBe(TransactionStatus.APPROVED);
    expect(products.currentStock('product-1')?.reservedUnits).toBe(0);
    expect(deliveries.current('transaction-1')?.status).toBe(DeliveryStatus.ASSIGNED);
  });

  it('asks the gateway using the stored gateway id', async () => {
    const { useCase, gateway } = setup();

    await useCase.execute('TX-REF-1');

    expect(gateway.lookups).toEqual(['gw-1']);
  });

  it('leaves the transaction pending while the gateway is still processing', async () => {
    const { useCase, gateway, products } = setup();
    gateway.findResult = { gatewayTransactionId: 'gw-1', gatewayStatus: 'PENDING' };

    const result = await useCase.execute('TX-REF-1');

    expect(result.ok && result.value.status).toBe(TransactionStatus.PENDING);
    expect(products.currentStock('product-1')?.reservedUnits).toBe(2);
  });

  it('does not call the gateway when the payment was never sent', async () => {
    const { useCase, gateway } = setup({ withGatewayId: false });

    const result = await useCase.execute('TX-REF-1');

    expect(result.ok && result.value.status).toBe(TransactionStatus.PENDING);
    expect(gateway.lookups).toHaveLength(0);
  });

  it('does not call the gateway for a transaction that already finished', async () => {
    const { useCase, gateway } = setup();
    gateway.findResult = { gatewayTransactionId: 'gw-1', gatewayStatus: 'APPROVED' };

    await useCase.execute('TX-REF-1');
    await useCase.execute('TX-REF-1');

    expect(gateway.lookups).toHaveLength(1);
  });

  it('still returns the transaction when the gateway cannot be reached', async () => {
    const { useCase, gateway } = setup();
    gateway.findFails = true;

    const result = await useCase.execute('TX-REF-1');

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.status).toBe(TransactionStatus.PENDING);
  });

  it('releases the units when the gateway reports a decline', async () => {
    const { useCase, gateway, products } = setup();
    gateway.findResult = {
      gatewayTransactionId: 'gw-1',
      gatewayStatus: 'DECLINED',
      failureReason: 'Rechazada',
    };

    const result = await useCase.execute('TX-REF-1');

    expect(result.ok && result.value.status).toBe(TransactionStatus.DECLINED);
    expect(products.currentStock('product-1')?.availableUnits).toBe(12);
  });
});
