import { SettleDeliveryUseCase } from '@/contexts/deliveries/application/settle-delivery.use-case';
import { Delivery, DeliveryAddress } from '@/contexts/deliveries/domain/delivery';
import { HandleGatewayEventUseCase } from '@/contexts/payments/application/handle-gateway-event.use-case';
import { SettleTransactionService } from '@/contexts/payments/application/settle-transaction.service';
import { AmountBreakdown } from '@/contexts/payments/domain/amount-breakdown';
import { PaymentTransaction } from '@/contexts/payments/domain/payment-transaction';
import { type GatewayEvent } from '@/contexts/payments/domain/ports/payment-gateway.port';
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

import { CheckoutConfigController } from './checkout-config.controller';
import { PaymentEventsController } from './payment-events.controller';

const NOW = new Date('2026-07-24T12:00:05.000Z');

const money = (cents: number): Money => {
  const result = Money.fromCents(cents);
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

describe('CheckoutConfigController', () => {
  it('exposes only public gateway data', async () => {
    const controller = new CheckoutConfigController(new FakePaymentGateway());

    const response = await controller.getConfig();

    expect(response).toEqual({
      publicKey: 'pub_test',
      tokenizationUrl: 'https://gateway.test/v1/tokens/cards',
      acceptanceToken: 'acc_test',
      personalDataAuthToken: null,
      termsUrl: null,
    });
  });
});

describe('PaymentEventsController', () => {
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
    const controller = new PaymentEventsController(
      new HandleGatewayEventUseCase(
        new FakeUnitOfWork(),
        transactions,
        gateway,
        new SettleTransactionService(
          transactions,
          products,
          clock,
          new SettleDeliveryUseCase(deliveries, clock),
        ),
      ),
    );

    return { controller, gateway, transactions };
  };

  const event: GatewayEvent = {
    event: 'transaction.updated',
    data: { transaction: { id: 'gw-1', reference: 'TX-REF-1', status: 'APPROVED' } },
    timestamp: 1784926800,
    signature: { properties: ['transaction.id'], checksum: 'abc' },
  };

  it('acknowledges a valid event', async () => {
    const { controller } = setup();

    await expect(controller.receive(event)).resolves.toEqual({ received: true });
  });

  it('answers 400 when the signature does not verify', async () => {
    const { controller, gateway } = setup();
    gateway.signatureValid = false;

    await expect(controller.receive(event)).rejects.toMatchObject({ status: 400 });
  });

  it('answers 404 when the transaction is unknown', async () => {
    const { controller } = setup();

    await expect(
      controller.receive({
        ...event,
        data: { transaction: { id: 'gw-1', reference: 'TX-MISSING', status: 'APPROVED' } },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
