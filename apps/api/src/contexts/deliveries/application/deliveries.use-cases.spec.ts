import { DeliveryStatus } from '@/contexts/deliveries/domain/delivery';
import { Money } from '@/shared/domain/money';
import {
  FixedClock,
  InMemoryDeliveryRepository,
  SequentialIdGenerator,
} from '@test/fakes/in-memory-repositories';

import { CreateDeliveryUseCase } from './create-delivery.use-case';
import { GetDeliveryUseCase } from './get-delivery.use-case';
import { SettleDeliveryUseCase } from './settle-delivery.use-case';
import { UpdateDeliveryStatusUseCase } from './update-delivery-status.use-case';

const NOW = new Date('2026-07-24T12:00:00.000Z');

const fee = (): Money => {
  const result = Money.fromCents(1000000);
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const address = {
  recipientName: 'Ana Pérez',
  recipientPhone: '+573001112233',
  addressLine1: 'Calle 123 # 45-67',
  city: 'Medellín',
  region: 'Antioquia',
};

const setup = () => {
  const deliveries = new InMemoryDeliveryRepository();
  const clock = new FixedClock(NOW);

  return {
    deliveries,
    create: new CreateDeliveryUseCase(deliveries, new SequentialIdGenerator('delivery')),
    settle: new SettleDeliveryUseCase(deliveries, clock),
    get: new GetDeliveryUseCase(deliveries),
    update: new UpdateDeliveryStatusUseCase(deliveries),
  };
};

const seed = async (context: ReturnType<typeof setup>) =>
  context.create.execute({
    transactionId: 'transaction-1',
    customerId: 'customer-1',
    address,
    fee: fee(),
  });

describe('CreateDeliveryUseCase', () => {
  it('opens a pending delivery', async () => {
    const context = setup();

    const result = await seed(context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe(DeliveryStatus.PENDING);
    expect(result.value.address.city).toBe('Medellín');
  });

  it('rejects an incomplete address', async () => {
    const context = setup();

    const result = await context.create.execute({
      transactionId: 'transaction-1',
      customerId: 'customer-1',
      address: { ...address, city: '' },
      fee: fee(),
    });

    expect(result.ok ? null : result.error.code).toBe('INVALID_DELIVERY_ADDRESS');
  });
});

describe('SettleDeliveryUseCase', () => {
  it('assigns the delivery with a tracking code', async () => {
    const context = setup();
    await seed(context);

    const result = await context.settle.assign('transaction-1', 'TX-REF-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe(DeliveryStatus.ASSIGNED);
    expect(result.value.trackingCode).toBe('TX-REF-1');
    expect(result.value.assignedAt).toEqual(NOW);
  });

  it('cancels the delivery', async () => {
    const context = setup();
    await seed(context);

    const result = await context.settle.cancel('transaction-1');

    expect(result.ok && result.value.status).toBe(DeliveryStatus.CANCELLED);
  });

  it('fails when there is no delivery for the transaction', async () => {
    const context = setup();

    const result = await context.settle.assign('missing', 'TX-REF-1');

    expect(result.ok ? null : result.error.code).toBe('DELIVERY_NOT_FOUND');
  });

  it('rejects assigning a cancelled delivery', async () => {
    const context = setup();
    await seed(context);
    await context.settle.cancel('transaction-1');

    const result = await context.settle.assign('transaction-1', 'TX-REF-1');

    expect(result.ok ? null : result.error.code).toBe('INVALID_DELIVERY_TRANSITION');
  });
});

describe('GetDeliveryUseCase', () => {
  it('returns the delivery of a transaction', async () => {
    const context = setup();
    await seed(context);

    const result = await context.get.execute('transaction-1');

    expect(result.ok && result.value.transactionId).toBe('transaction-1');
  });

  it('fails for an unknown transaction', async () => {
    const context = setup();

    const result = await context.get.execute('missing');

    expect(result.ok ? null : result.error.code).toBe('DELIVERY_NOT_FOUND');
  });
});

describe('UpdateDeliveryStatusUseCase', () => {
  it('advances an assigned delivery to shipped', async () => {
    const context = setup();
    await seed(context);
    await context.settle.assign('transaction-1', 'TX-REF-1');

    const result = await context.update.execute('transaction-1', DeliveryStatus.SHIPPED);

    expect(result.ok && result.value.status).toBe(DeliveryStatus.SHIPPED);
  });

  it('refuses to skip the assignment step', async () => {
    const context = setup();
    await seed(context);

    const result = await context.update.execute('transaction-1', DeliveryStatus.DELIVERED);

    expect(result.ok ? null : result.error.code).toBe('INVALID_DELIVERY_TRANSITION');
  });

  it('fails for an unknown transaction', async () => {
    const context = setup();

    const result = await context.update.execute('missing', DeliveryStatus.SHIPPED);

    expect(result.ok ? null : result.error.code).toBe('DELIVERY_NOT_FOUND');
  });
});
