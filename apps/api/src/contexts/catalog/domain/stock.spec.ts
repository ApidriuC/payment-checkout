import {
  InsufficientStockError,
  InvalidQuantityError,
  InvalidStockOperationError,
} from './errors';
import { Stock } from './stock';

const PRODUCT_ID = 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const stockWith = (availableUnits: number, reservedUnits = 0): Stock =>
  Stock.rehydrate({ productId: PRODUCT_ID, availableUnits, reservedUnits, version: 1 });

describe('Stock', () => {
  describe('canFulfil', () => {
    it('accepts a quantity within the available units', () => {
      expect(stockWith(5).canFulfil(5)).toBe(true);
    });

    it('rejects a quantity above the available units', () => {
      expect(stockWith(5).canFulfil(6)).toBe(false);
    });

    it('rejects a non-positive quantity', () => {
      expect(stockWith(5).canFulfil(0)).toBe(false);
    });
  });

  describe('reserve', () => {
    it('moves units from available to reserved', () => {
      const result = stockWith(10, 2).reserve(3);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.availableUnits).toBe(7);
        expect(result.value.reservedUnits).toBe(5);
      }
    });

    it('allows reserving the last available unit', () => {
      const result = stockWith(1).reserve(1);

      expect(result.ok && result.value.availableUnits).toBe(0);
    });

    it('fails when there are not enough units', () => {
      const result = stockWith(2).reserve(3);

      expect(result.ok).toBe(false);
      expect(result.ok ? null : result.error).toBeInstanceOf(InsufficientStockError);
    });

    it('fails for a non-positive quantity', () => {
      const result = stockWith(5).reserve(0);

      expect(result.ok ? null : result.error).toBeInstanceOf(InvalidQuantityError);
    });

    it('does not mutate the original stock', () => {
      const original = stockWith(10);

      original.reserve(4);

      expect(original.availableUnits).toBe(10);
    });
  });

  describe('confirmReservation', () => {
    it('consumes reserved units without returning them to available', () => {
      const result = stockWith(7, 3).confirmReservation(3);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.availableUnits).toBe(7);
        expect(result.value.reservedUnits).toBe(0);
      }
    });

    it('fails when there are fewer reserved units than requested', () => {
      const result = stockWith(7, 1).confirmReservation(2);

      expect(result.ok ? null : result.error).toBeInstanceOf(InvalidStockOperationError);
    });

    it('fails for a non-positive quantity', () => {
      const result = stockWith(7, 3).confirmReservation(-1);

      expect(result.ok ? null : result.error).toBeInstanceOf(InvalidQuantityError);
    });
  });

  describe('releaseReservation', () => {
    it('returns reserved units to available', () => {
      const result = stockWith(7, 3).releaseReservation(3);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.availableUnits).toBe(10);
        expect(result.value.reservedUnits).toBe(0);
      }
    });

    it('fails when there are fewer reserved units than requested', () => {
      const result = stockWith(7, 1).releaseReservation(5);

      expect(result.ok ? null : result.error).toBeInstanceOf(InvalidStockOperationError);
    });

    it('fails for a non-positive quantity', () => {
      const result = stockWith(7, 3).releaseReservation(0);

      expect(result.ok ? null : result.error).toBeInstanceOf(InvalidQuantityError);
    });
  });

  describe('reserve then release', () => {
    it('restores the original balance', () => {
      const reserved = stockWith(10).reserve(4);
      const released = reserved.ok ? reserved.value.releaseReservation(4) : reserved;

      expect(released.ok).toBe(true);
      if (released.ok) {
        expect(released.value.availableUnits).toBe(10);
        expect(released.value.reservedUnits).toBe(0);
      }
    });
  });

  describe('toSnapshot', () => {
    it('exposes the persistable state', () => {
      expect(stockWith(4, 1).toSnapshot()).toEqual({
        productId: PRODUCT_ID,
        availableUnits: 4,
        reservedUnits: 1,
        version: 1,
      });
    });
  });
});
