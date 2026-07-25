import { EMPTY_DELIVERY } from '@/domain/delivery';

import {
  checkoutReducer,
  checkoutReset,
  checkoutStarted,
  deliveryChanged,
  detailsCompleted,
  initialCheckoutState,
  quantityChanged,
  referenceCreated,
  resultReached,
  steppedBack,
  type CheckoutState,
} from './checkout.slice';

const reduce = (state: CheckoutState, action: Parameters<typeof checkoutReducer>[1]) =>
  checkoutReducer(state, action);

describe('checkout slice', () => {
  it('starts on the product step', () => {
    expect(checkoutReducer(undefined, { type: '@@INIT' })).toEqual(initialCheckoutState);
  });

  describe('checkoutStarted', () => {
    it('records the chosen product and moves to the details step', () => {
      const state = reduce(
        initialCheckoutState,
        checkoutStarted({ productId: 'product-1', quantity: 2 }),
      );

      expect(state.productId).toBe('product-1');
      expect(state.quantity).toBe(2);
      expect(state.step).toBe('details');
    });

    it('clears a reference left by a previous purchase', () => {
      const previous = { ...initialCheckoutState, reference: 'TX-OLD' };

      const state = reduce(previous, checkoutStarted({ productId: 'product-1', quantity: 1 }));

      expect(state.reference).toBeNull();
    });
  });

  describe('quantityChanged', () => {
    it('updates the quantity', () => {
      expect(reduce(initialCheckoutState, quantityChanged(4)).quantity).toBe(4);
    });

    it('never drops below one unit', () => {
      expect(reduce(initialCheckoutState, quantityChanged(0)).quantity).toBe(1);
      expect(reduce(initialCheckoutState, quantityChanged(-3)).quantity).toBe(1);
    });
  });

  describe('deliveryChanged', () => {
    it('merges partial updates', () => {
      const first = reduce(initialCheckoutState, deliveryChanged({ city: 'Medellín' }));
      const second = reduce(first, deliveryChanged({ region: 'Antioquia' }));

      expect(second.delivery.city).toBe('Medellín');
      expect(second.delivery.region).toBe('Antioquia');
    });

    it('leaves untouched fields alone', () => {
      const state = reduce(initialCheckoutState, deliveryChanged({ city: 'Cali' }));

      expect(state.delivery.email).toBe(EMPTY_DELIVERY.email);
    });
  });

  describe('detailsCompleted', () => {
    it('stores only the non-sensitive card preview and advances to the summary', () => {
      const state = reduce(
        initialCheckoutState,
        detailsCompleted({ card: { brand: 'VISA', lastFour: '4242', holder: 'ANA PEREZ' } }),
      );

      expect(state.step).toBe('summary');
      expect(state.card).toEqual({ brand: 'VISA', lastFour: '4242', holder: 'ANA PEREZ' });
    });

    it('never keeps the full card number in state', () => {
      const state = reduce(
        initialCheckoutState,
        detailsCompleted({ card: { brand: 'VISA', lastFour: '4242', holder: 'ANA PEREZ' } }),
      );

      expect(JSON.stringify(state)).not.toContain('4242424242424242');
    });
  });

  describe('referenceCreated', () => {
    it('stores the transaction reference', () => {
      expect(reduce(initialCheckoutState, referenceCreated('TX-REF-1')).reference).toBe('TX-REF-1');
    });
  });

  describe('resultReached', () => {
    it('moves to the result step', () => {
      expect(reduce(initialCheckoutState, resultReached()).step).toBe('result');
    });
  });

  describe('steppedBack', () => {
    it('goes from summary back to details', () => {
      const summary = { ...initialCheckoutState, step: 'summary' as const };

      expect(reduce(summary, steppedBack()).step).toBe('details');
    });

    it('goes from details back to the product list', () => {
      const details = { ...initialCheckoutState, step: 'details' as const };

      expect(reduce(details, steppedBack()).step).toBe('product');
    });

    it('does nothing on the first step', () => {
      expect(reduce(initialCheckoutState, steppedBack()).step).toBe('product');
    });
  });

  describe('checkoutReset', () => {
    it('wipes the whole checkout', () => {
      const dirty: CheckoutState = {
        step: 'result',
        productId: 'product-1',
        quantity: 3,
        delivery: { ...EMPTY_DELIVERY, city: 'Medellín' },
        card: { brand: 'VISA', lastFour: '4242', holder: 'ANA PEREZ' },
        reference: 'TX-REF-1',
      };

      expect(reduce(dirty, checkoutReset())).toEqual(initialCheckoutState);
    });
  });
});
