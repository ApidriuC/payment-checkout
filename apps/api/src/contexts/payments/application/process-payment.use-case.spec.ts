import { SettleDeliveryUseCase } from '@/contexts/deliveries/application/settle-delivery.use-case';
import { Delivery, DeliveryAddress, DeliveryStatus } from '@/contexts/deliveries/domain/delivery';
import { Customer } from '@/contexts/customers/domain/customer';
import { AmountBreakdown } from '@/contexts/payments/domain/amount-breakdown';
import { CardBrand } from '@/contexts/payments/domain/card-summary';
import { PaymentTransaction } from '@/contexts/payments/domain/payment-transaction';
import { TransactionStatus } from '@/contexts/payments/domain/transaction-status';
import { Money } from '@/shared/domain/money';
import { FakePaymentGateway } from '@test/fakes/fake-payment-gateway';
import {
  buildProduct,
  FakeUnitOfWork,
  FixedClock,
  InMemoryCustomerRepository,
  InMemoryDeliveryRepository,
  InMemoryProductRepository,
  InMemoryTransactionRepository,
} from '@test/fakes/in-memory-repositories';

import { ProcessPaymentUseCase, type ProcessPaymentInput } from './process-payment.use-case';
import { SettleTransactionService } from './settle-transaction.service';

const NOW = new Date('2026-07-24T12:00:05.000Z');

const money = (cents: number): Money => {
  const result = Money.fromCents(cents);
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const setup = () => {
  const products = new InMemoryProductRepository();
  const customers = new InMemoryCustomerRepository();
  const transactions = new InMemoryTransactionRepository();
  const deliveries = new InMemoryDeliveryRepository();
  const gateway = new FakePaymentGateway();
  const unitOfWork = new FakeUnitOfWork();

  products.add(buildProduct({ stock: { availableUnits: 10, reservedUnits: 2, version: 1 } }));

  const customer = Customer.create({
    id: 'customer-1',
    email: 'ana.perez@example.com',
    fullName: 'Ana Pérez',
    phoneNumber: '+573001112233',
  });
  if (!customer.ok) throw new Error('fixture');
  customers.add(customer.value);

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
  const useCase = new ProcessPaymentUseCase(
    unitOfWork,
    transactions,
    customers,
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

const input = (overrides: Partial<ProcessPaymentInput> = {}): ProcessPaymentInput => ({
  reference: 'TX-REF-1',
  cardToken: 'tok_test_1234567890',
  acceptanceToken: 'acc_test_1234567890',
  installments: 1,
  cardBrand: 'VISA',
  cardLastFour: '4242',
  ...overrides,
});

describe('ProcessPaymentUseCase', () => {
  it('sends the total amount and the buyer email to the gateway', async () => {
    const { useCase, gateway } = setup();

    await useCase.execute(input());

    expect(gateway.chargeRequests).toHaveLength(1);
    expect(gateway.chargeRequests[0]).toMatchObject({
      reference: 'TX-REF-1',
      amountInCents: 93480000,
      currency: 'COP',
      customerEmail: 'ana.perez@example.com',
      cardToken: 'tok_test_1234567890',
      installments: 1,
    });
  });

  it('stores only the card brand and last four digits', async () => {
    const { useCase, transactions } = setup();

    const result = await useCase.execute(input());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.card?.brand).toBe(CardBrand.VISA);
    expect(result.value.card?.lastFour).toBe('4242');
    expect(JSON.stringify(transactions.current('TX-REF-1'))).not.toContain('tok_test');
  });

  it('approves the transaction when the gateway approves it', async () => {
    const { useCase, products, deliveries } = setup();

    const result = await useCase.execute(input());

    expect(result.ok && result.value.status).toBe(TransactionStatus.APPROVED);
    expect(products.currentStock('product-1')?.reservedUnits).toBe(0);
    expect(deliveries.current('transaction-1')?.status).toBe(DeliveryStatus.ASSIGNED);
  });

  it('declines the transaction and releases the units', async () => {
    const { useCase, gateway, products, deliveries } = setup();
    gateway.chargeResult = {
      gatewayTransactionId: 'gw-1',
      gatewayStatus: 'DECLINED',
      failureReason: 'Fondos insuficientes',
    };

    const result = await useCase.execute(input());

    expect(result.ok && result.value.status).toBe(TransactionStatus.DECLINED);
    expect(result.ok && result.value.failureReason).toBe('Fondos insuficientes');
    expect(products.currentStock('product-1')?.availableUnits).toBe(12);
    expect(deliveries.current('transaction-1')?.status).toBe(DeliveryStatus.CANCELLED);
  });

  it('keeps the transaction pending while the gateway processes it asynchronously', async () => {
    const { useCase, gateway, products } = setup();
    gateway.chargeResult = { gatewayTransactionId: 'gw-1', gatewayStatus: 'PENDING' };

    const result = await useCase.execute(input());

    expect(result.ok && result.value.status).toBe(TransactionStatus.PENDING);
    expect(products.currentStock('product-1')?.reservedUnits).toBe(2);
  });

  it('fails the transaction and gives the units back when the gateway is unreachable', async () => {
    const { useCase, gateway, products, deliveries } = setup();
    gateway.chargeFails = true;

    const result = await useCase.execute(input());

    expect(result.ok && result.value.status).toBe(TransactionStatus.ERROR);
    expect(products.currentStock('product-1')?.availableUnits).toBe(12);
    expect(deliveries.current('transaction-1')?.status).toBe(DeliveryStatus.CANCELLED);
  });

  it('rejects a malformed card summary before calling the gateway', async () => {
    const { useCase, gateway } = setup();

    const result = await useCase.execute(input({ cardLastFour: '42' }));

    expect(result.ok ? null : result.error.code).toBe('INVALID_CARD_SUMMARY');
    expect(gateway.chargeRequests).toHaveLength(0);
  });

  it('fails when the transaction does not exist', async () => {
    const { useCase } = setup();

    const result = await useCase.execute(input({ reference: 'TX-MISSING' }));

    expect(result.ok ? null : result.error.code).toBe('TRANSACTION_NOT_FOUND');
  });

  it('refuses to pay a transaction that already finished', async () => {
    const { useCase } = setup();

    await useCase.execute(input());
    const second = await useCase.execute(input());

    expect(second.ok ? null : second.error.code).toBe('TRANSACTION_ALREADY_FINALIZED');
  });

  it('forwards the personal data authorization token when present', async () => {
    const { useCase, gateway } = setup();

    await useCase.execute(input({ personalDataAuthToken: 'auth_test_123456' }));

    expect(gateway.chargeRequests[0].personalDataAuthToken).toBe('auth_test_123456');
  });
});
