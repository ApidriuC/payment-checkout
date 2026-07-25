import { CreateDeliveryUseCase } from '@/contexts/deliveries/application/create-delivery.use-case';
import { GetDeliveryUseCase } from '@/contexts/deliveries/application/get-delivery.use-case';
import { SettleDeliveryUseCase } from '@/contexts/deliveries/application/settle-delivery.use-case';
import { UpdateDeliveryStatusUseCase } from '@/contexts/deliveries/application/update-delivery-status.use-case';
import { DeliveryStatus } from '@/contexts/deliveries/domain/delivery';
import { Money } from '@/shared/domain/money';
import {
  FixedClock,
  InMemoryDeliveryRepository,
  SequentialIdGenerator,
} from '@test/fakes/in-memory-repositories';

import { DeliveriesController } from './deliveries.controller';

const NOW = new Date('2026-07-24T12:00:00.000Z');

const fee = (): Money => {
  const result = Money.fromCents(1000000);
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const setup = async () => {
  const deliveries = new InMemoryDeliveryRepository();
  const clock = new FixedClock(NOW);
  const create = new CreateDeliveryUseCase(deliveries, new SequentialIdGenerator('delivery'));
  const settle = new SettleDeliveryUseCase(deliveries, clock);

  await create.execute({
    transactionId: 'transaction-1',
    customerId: 'customer-1',
    address: {
      recipientName: 'Ana Pérez',
      recipientPhone: '+573001112233',
      addressLine1: 'Calle 123 # 45-67',
      addressLine2: 'Apto 302',
      city: 'Medellín',
      region: 'Antioquia',
    },
    fee: fee(),
  });

  return {
    controller: new DeliveriesController(
      new GetDeliveryUseCase(deliveries),
      new UpdateDeliveryStatusUseCase(deliveries),
    ),
    settle,
  };
};

describe('DeliveriesController', () => {
  describe('GET /deliveries/:transactionId', () => {
    it('returns the delivery of a transaction', async () => {
      const { controller } = await setup();

      const response = await controller.findOne('transaction-1');

      expect(response).toMatchObject({
        transactionId: 'transaction-1',
        customerId: 'customer-1',
        status: DeliveryStatus.PENDING,
        recipientName: 'Ana Pérez',
        addressLine1: 'Calle 123 # 45-67',
        addressLine2: 'Apto 302',
        city: 'Medellín',
        region: 'Antioquia',
        country: 'CO',
        deliveryFeeInCents: 1000000,
        trackingCode: null,
        assignedAt: null,
      });
    });

    it('answers 404 when there is no delivery', async () => {
      const { controller } = await setup();

      await expect(controller.findOne('missing')).rejects.toMatchObject({ status: 404 });
    });

    it('exposes the tracking code once assigned', async () => {
      const { controller, settle } = await setup();
      await settle.assign('transaction-1', 'TX-REF-1');

      const response = await controller.findOne('transaction-1');

      expect(response.status).toBe(DeliveryStatus.ASSIGNED);
      expect(response.trackingCode).toBe('TX-REF-1');
      expect(response.assignedAt).toBe(NOW.toISOString());
    });
  });

  describe('PATCH /deliveries/:transactionId/status', () => {
    it('advances an assigned delivery', async () => {
      const { controller, settle } = await setup();
      await settle.assign('transaction-1', 'TX-REF-1');

      const response = await controller.update('transaction-1', {
        status: DeliveryStatus.SHIPPED,
      });

      expect(response.status).toBe(DeliveryStatus.SHIPPED);
    });

    it('answers 409 on a forbidden transition', async () => {
      const { controller } = await setup();

      await expect(
        controller.update('transaction-1', { status: DeliveryStatus.DELIVERED }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('answers 404 for an unknown transaction', async () => {
      const { controller } = await setup();

      await expect(
        controller.update('missing', { status: DeliveryStatus.SHIPPED }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });
});
