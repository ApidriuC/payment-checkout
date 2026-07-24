import { Money } from '@/shared/domain/money';

import {
  Delivery,
  DeliveryAddress,
  type DeliveryAddressInput,
  DeliveryStatus,
  InvalidDeliveryAddressError,
  InvalidDeliveryTransitionError,
} from './delivery';

const ASSIGNED_AT = new Date('2026-07-24T12:00:00.000Z');

const addressInput = (overrides: Partial<DeliveryAddressInput> = {}): DeliveryAddressInput => ({
  recipientName: 'Ana Pérez',
  recipientPhone: '+573001112233',
  addressLine1: 'Calle 123 # 45-67',
  addressLine2: 'Apto 302',
  city: 'Medellín',
  region: 'Antioquia',
  country: 'CO',
  postalCode: '050001',
  ...overrides,
});

const fee = (): Money => {
  const result = Money.fromCents(1000000);
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const address = (overrides: Partial<DeliveryAddressInput> = {}): DeliveryAddress => {
  const result = DeliveryAddress.create(addressInput(overrides));
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const delivery = (): Delivery =>
  Delivery.create({
    id: 'aa11bb22-cc33-4d44-8e55-ff66aa77bb88',
    transactionId: 'f1e2d3c4-b5a6-4978-8899-aabbccddeeff',
    customerId: 'd1e2f3a4-b5c6-4d7e-8f90-1a2b3c4d5e6f',
    address: address(),
    fee: fee(),
  });

describe('DeliveryAddress', () => {
  it('trims every field', () => {
    const result = DeliveryAddress.create(addressInput({ city: '  Medellín  ' }));

    expect(result.ok && result.value.city).toBe('Medellín');
  });

  it('defaults the country to CO and uppercases it', () => {
    const result = DeliveryAddress.create(addressInput({ country: undefined }));

    expect(result.ok && result.value.country).toBe('CO');
  });

  it('turns a blank optional field into null', () => {
    const result = DeliveryAddress.create(addressInput({ addressLine2: '   ' }));

    expect(result.ok && result.value.addressLine2).toBeNull();
  });

  it.each(['recipientName', 'recipientPhone', 'addressLine1', 'city', 'region'] as const)(
    'rejects a missing %s',
    (field) => {
      const result = DeliveryAddress.create(addressInput({ [field]: ' ' }));

      expect(result.ok).toBe(false);
      expect(result.ok ? null : result.error).toBeInstanceOf(InvalidDeliveryAddressError);
    },
  );

  it('rejects a country code that is not two letters', () => {
    expect(DeliveryAddress.create(addressInput({ country: 'COL' })).ok).toBe(false);
  });
});

describe('Delivery', () => {
  it('starts pending and unassigned', () => {
    const created = delivery();

    expect(created.status).toBe(DeliveryStatus.PENDING);
    expect(created.trackingCode).toBeNull();
    expect(created.assignedAt).toBeNull();
  });

  describe('assign', () => {
    it('moves a pending delivery to assigned with its tracking code', () => {
      const result = delivery().assign('TX-ABC', ASSIGNED_AT);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe(DeliveryStatus.ASSIGNED);
        expect(result.value.trackingCode).toBe('TX-ABC');
        expect(result.value.assignedAt).toEqual(ASSIGNED_AT);
      }
    });

    it('cannot assign twice', () => {
      const assigned = delivery().assign('TX-ABC', ASSIGNED_AT);
      if (!assigned.ok) throw new Error('fixture');

      const again = assigned.value.assign('TX-DEF', ASSIGNED_AT);

      expect(again.ok).toBe(false);
      expect(again.ok ? null : again.error).toBeInstanceOf(InvalidDeliveryTransitionError);
    });
  });

  describe('cancel', () => {
    it('cancels a pending delivery', () => {
      const result = delivery().cancel();

      expect(result.ok && result.value.status).toBe(DeliveryStatus.CANCELLED);
    });

    it('cancels an assigned delivery', () => {
      const assigned = delivery().assign('TX-ABC', ASSIGNED_AT);
      if (!assigned.ok) throw new Error('fixture');

      expect(assigned.value.cancel().ok).toBe(true);
    });

    it('cannot cancel twice', () => {
      const cancelled = delivery().cancel();
      if (!cancelled.ok) throw new Error('fixture');

      expect(cancelled.value.cancel().ok).toBe(false);
    });
  });

  describe('markAs', () => {
    it('walks the happy path pending → assigned → shipped → delivered', () => {
      const assigned = delivery().assign('TX-ABC', ASSIGNED_AT);
      if (!assigned.ok) throw new Error('fixture');

      const shipped = assigned.value.markAs(DeliveryStatus.SHIPPED);
      if (!shipped.ok) throw new Error('fixture');

      const delivered = shipped.value.markAs(DeliveryStatus.DELIVERED);

      expect(delivered.ok && delivered.value.status).toBe(DeliveryStatus.DELIVERED);
    });

    it('refuses to skip a step', () => {
      expect(delivery().markAs(DeliveryStatus.SHIPPED).ok).toBe(false);
    });

    it('refuses to move a delivered order', () => {
      const assigned = delivery().assign('TX-ABC', ASSIGNED_AT);
      if (!assigned.ok) throw new Error('fixture');
      const shipped = assigned.value.markAs(DeliveryStatus.SHIPPED);
      if (!shipped.ok) throw new Error('fixture');
      const delivered = shipped.value.markAs(DeliveryStatus.DELIVERED);
      if (!delivered.ok) throw new Error('fixture');

      expect(delivered.value.markAs(DeliveryStatus.CANCELLED).ok).toBe(false);
    });
  });

  describe('snapshot round trip', () => {
    it('rehydrates into an equivalent delivery', () => {
      const assigned = delivery().assign('TX-ABC', ASSIGNED_AT);
      if (!assigned.ok) throw new Error('fixture');

      const snapshot = assigned.value.toSnapshot();
      const restored = Delivery.rehydrate(snapshot, fee());

      expect(restored.ok).toBe(true);
      if (restored.ok) {
        expect(restored.value.toSnapshot()).toEqual(snapshot);
      }
    });
  });
});
