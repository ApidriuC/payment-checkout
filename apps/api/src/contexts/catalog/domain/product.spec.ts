import { InvalidQuantityError } from './errors';
import { Product, type ProductSnapshot } from './product';

const snapshot = (overrides: Partial<ProductSnapshot> = {}): ProductSnapshot => ({
  id: 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  sku: 'AUD-ORBIT-01',
  name: 'Audífonos Orbit Pro',
  description: 'Audífonos over-ear con cancelación activa de ruido.',
  priceInCents: 45990000,
  currency: 'COP',
  imageUrl: '/images/products/orbit-headphones.svg',
  stock: { availableUnits: 12, reservedUnits: 0, version: 1 },
  ...overrides,
});

const build = (overrides: Partial<ProductSnapshot> = {}): Product => {
  const result = Product.rehydrate(snapshot(overrides));
  if (!result.ok) {
    throw new Error('expected a valid product in the fixture');
  }
  return result.value;
};

describe('Product', () => {
  describe('rehydrate', () => {
    it('rebuilds the product with its price and stock', () => {
      const product = build();

      expect(product.sku).toBe('AUD-ORBIT-01');
      expect(product.price.amountInCents).toBe(45990000);
      expect(product.stock.availableUnits).toBe(12);
    });

    it('links the stock to the product id', () => {
      expect(build().stock.productId).toBe('a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d');
    });

    it('fails when the stored price is invalid', () => {
      const result = Product.rehydrate(snapshot({ priceInCents: -1 }));

      expect(result.ok).toBe(false);
    });
  });

  describe('isAvailable', () => {
    it('is true when there are units left', () => {
      expect(build().isAvailable).toBe(true);
    });

    it('is false when the product is sold out', () => {
      expect(build({ stock: { availableUnits: 0, reservedUnits: 3, version: 1 } }).isAvailable).toBe(
        false,
      );
    });
  });

  describe('amountFor', () => {
    it('multiplies the unit price by the quantity', () => {
      const result = build().amountFor(3);

      expect(result.ok && result.value.amountInCents).toBe(137970000);
    });

    it('rejects a quantity of zero', () => {
      const result = build().amountFor(0);

      expect(result.ok ? null : result.error).toBeInstanceOf(InvalidQuantityError);
    });

    it('rejects a negative quantity', () => {
      expect(build().amountFor(-2).ok).toBe(false);
    });

    it('rejects a fractional quantity', () => {
      expect(build().amountFor(1.5).ok).toBe(false);
    });
  });
});
