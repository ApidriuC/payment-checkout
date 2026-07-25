import { SettleDeliveryUseCase } from '@/contexts/deliveries/application/settle-delivery.use-case';
import { Delivery, DeliveryAddress, DeliveryStatus } from '@/contexts/deliveries/domain/delivery';
import { AmountBreakdown } from '@/contexts/payments/domain/amount-breakdown';
import { PaymentTransaction } from '@/contexts/payments/domain/payment-transaction';
import { TransactionEventSource } from '@/contexts/payments/domain/ports/transaction.repository';
import { TransactionStatus } from '@/contexts/payments/domain/transaction-status';
import { Money } from '@/shared/domain/money';
import {
  buildProduct,
  FAKE_CONTEXT,
  FixedClock,
  InMemoryDeliveryRepository,
  InMemoryProductRepository,
  InMemoryTransactionRepository,
} from '@test/fakes/in-memory-repositories';

import { SettleTransactionService } from './settle-transaction.service';

const NOW = new Date('2026-07-24T12:00:05.000Z');

const money = (cents: number): Money => {
  const result = Money.fromCents(cents);
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const amounts = (): AmountBreakdown => {
  const result = AmountBreakdown.create(money(91980000), money(500000), money(1000000));
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const address = (): DeliveryAddress => {
  const result = DeliveryAddress.create({
    recipientName: 'Ana Pérez',
    recipientPhone: '+573001112233',
    addressLine1: 'Calle 123 # 45-67',
    city: 'Medellín',
    region: 'Antioquia',
  });
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const setup = () => {
  const products = new InMemoryProductRepository();
  const transactions = new InMemoryTransactionRepository();
  const deliveries = new InMemoryDeliveryRepository();

  // Two units already reserved by the checkout that created the transaction.
  const product = buildProduct({ stock: { availableUnits: 10, reservedUnits: 2, version: 1 } });
  products.add(product);

  const transaction = PaymentTransaction.create({
    id: 'transaction-1',
    reference: 'TX-REF-1',
    customerId: 'customer-1',
    productId: 'product-1',
    quantity: 2,
    amounts: amounts(),
    createdAt: new Date('2026-07-24T12:00:00.000Z'),
  });
  transactions.add(transaction);

  deliveries.add(
    Delivery.create({
      id: 'delivery-1',
      transactionId: 'transaction-1',
      customerId: 'customer-1',
      address: address(),
      fee: money(1000000),
    }),
  );

  const clock = new FixedClock(NOW);
  const service = new SettleTransactionService(
    transactions,
    products,
    clock,
    new SettleDeliveryUseCase(deliveries, clock),
  );

  return { service, products, transactions, deliveries, transaction };
};

const settleWith = async (gatewayStatus: string) => {
  const context = setup();

  const result = await context.service.settle(
    {
      transaction: context.transaction,
      outcome: { gatewayTransactionId: 'gw-1', gatewayStatus },
      source: TransactionEventSource.API,
    },
    FAKE_CONTEXT,
  );

  return { ...context, result };
};

describe('SettleTransactionService', () => {
  describe('when the payment is approved', () => {
    it('finalizes the transaction', async () => {
      const { result } = await settleWith('APPROVED');

      expect(result.ok && result.value.status).toBe(TransactionStatus.APPROVED);
      expect(result.ok && result.value.completedAt).toEqual(NOW);
    });

    it('consumes the reserved units without returning them to stock', async () => {
      const { products } = await settleWith('APPROVED');

      const stock = products.currentStock('product-1');
      expect(stock?.availableUnits).toBe(10);
      expect(stock?.reservedUnits).toBe(0);
    });

    it('assigns the delivery to the buyer', async () => {
      const { deliveries } = await settleWith('APPROVED');

      const delivery = deliveries.current('transaction-1');
      expect(delivery?.status).toBe(DeliveryStatus.ASSIGNED);
      expect(delivery?.trackingCode).toBe('TX-REF-1');
    });

    it('logs the status change', async () => {
      const { transactions } = await settleWith('APPROVED');

      expect(transactions.events).toEqual([
        expect.objectContaining({
          fromStatus: TransactionStatus.PENDING,
          toStatus: TransactionStatus.APPROVED,
          source: TransactionEventSource.API,
        }),
      ]);
    });
  });

  describe.each(['DECLINED', 'VOIDED', 'ERROR'])('when the payment ends as %s', (status) => {
    it('returns the reserved units to the available pool', async () => {
      const { products } = await settleWith(status);

      const stock = products.currentStock('product-1');
      expect(stock?.availableUnits).toBe(12);
      expect(stock?.reservedUnits).toBe(0);
    });

    it('cancels the delivery', async () => {
      const { deliveries } = await settleWith(status);

      expect(deliveries.current('transaction-1')?.status).toBe(DeliveryStatus.CANCELLED);
    });
  });

  describe('when the gateway is still processing', () => {
    it('keeps the transaction pending', async () => {
      const { result } = await settleWith('PENDING');

      expect(result.ok && result.value.status).toBe(TransactionStatus.PENDING);
    });

    it('leaves the units reserved', async () => {
      const { products } = await settleWith('PENDING');

      const stock = products.currentStock('product-1');
      expect(stock?.availableUnits).toBe(10);
      expect(stock?.reservedUnits).toBe(2);
    });

    it('leaves the delivery pending', async () => {
      const { deliveries } = await settleWith('PENDING');

      expect(deliveries.current('transaction-1')?.status).toBe(DeliveryStatus.PENDING);
    });
  });

  it('treats an unrecognized gateway status as an error so nothing stays stuck', async () => {
    const { result, products } = await settleWith('SOMETHING_NEW');

    expect(result.ok && result.value.status).toBe(TransactionStatus.ERROR);
    expect(products.currentStock('product-1')?.availableUnits).toBe(12);
  });

  it('refuses to settle a transaction that already finished', async () => {
    const { service, transaction } = setup();

    const first = await service.settle(
      {
        transaction,
        outcome: { gatewayTransactionId: 'gw-1', gatewayStatus: 'APPROVED' },
        source: TransactionEventSource.API,
      },
      FAKE_CONTEXT,
    );
    if (!first.ok) throw new Error('expected success');

    const second = await service.settle(
      {
        transaction: first.value,
        outcome: { gatewayTransactionId: 'gw-2', gatewayStatus: 'DECLINED' },
        source: TransactionEventSource.GATEWAY_WEBHOOK,
      },
      FAKE_CONTEXT,
    );

    expect(second.ok ? null : second.error.code).toBe('TRANSACTION_ALREADY_FINALIZED');
  });

  it('fails when the stock cannot be written', async () => {
    const { service, products, transaction } = setup();
    products.failNextStockSave = true;

    const result = await service.settle(
      {
        transaction,
        outcome: { gatewayTransactionId: 'gw-1', gatewayStatus: 'APPROVED' },
        source: TransactionEventSource.API,
      },
      FAKE_CONTEXT,
    );

    expect(result.ok).toBe(false);
  });
});
