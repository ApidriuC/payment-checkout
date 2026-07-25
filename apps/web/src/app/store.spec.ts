import { checkoutStarted } from '@/features/checkout/checkout.slice';

import { persistor, setupStore, store } from './store';

describe('store', () => {
  it('builds without the persistence layer throwing', () => {
    expect(() => setupStore()).not.toThrow();
  });

  it('exposes every slice', () => {
    expect(Object.keys(store.getState())).toEqual(
      expect.arrayContaining(['catalog', 'checkout', 'payment']),
    );
  });

  it('creates a working persistor', () => {
    expect(typeof persistor.persist).toBe('function');
    expect(persistor.getState()).toHaveProperty('bootstrapped');
  });

  it('writes the checkout progress to storage', async () => {
    store.dispatch(checkoutStarted({ productId: 'product-1', quantity: 2 }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(window.localStorage.getItem('persist:checkout')).toContain('product-1');
  });

  it('does not persist the catalog, which is refetched on every visit', async () => {
    store.dispatch(checkoutStarted({ productId: 'product-1', quantity: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    const persisted = window.localStorage.getItem('persist:checkout') ?? '';
    expect(persisted).toContain('checkout');
    expect(persisted).not.toContain('catalog');
  });
});
