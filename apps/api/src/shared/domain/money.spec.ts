import { CurrencyMismatchError, InvalidMoneyAmountError, Money } from './money';

const cents = (amount: number, currency = 'COP'): Money => {
  const result = Money.fromCents(amount, currency);
  if (!result.ok) {
    throw new Error('expected a valid amount in the fixture');
  }
  return result.value;
};

describe('Money', () => {
  describe('fromCents', () => {
    it('accepts a non-negative integer', () => {
      expect(cents(1500).amountInCents).toBe(1500);
    });

    it('normalizes the currency to uppercase', () => {
      expect(cents(100, 'cop').currency).toBe('COP');
    });

    it('defaults to COP', () => {
      expect(cents(100).currency).toBe('COP');
    });

    it('rejects a negative amount', () => {
      const result = Money.fromCents(-1);

      expect(result.ok).toBe(false);
      expect(result.ok ? null : result.error).toBeInstanceOf(InvalidMoneyAmountError);
    });

    it('rejects a fractional amount', () => {
      const result = Money.fromCents(10.5);

      expect(result.ok).toBe(false);
    });

    it('rejects an unsafe integer', () => {
      const result = Money.fromCents(Number.MAX_SAFE_INTEGER + 2);

      expect(result.ok).toBe(false);
    });
  });

  describe('zero', () => {
    it('builds an empty amount', () => {
      expect(Money.zero().amountInCents).toBe(0);
    });
  });

  describe('add', () => {
    it('sums two amounts of the same currency', () => {
      const result = cents(1000).add(cents(500));

      expect(result.ok && result.value.amountInCents).toBe(1500);
    });

    it('rejects mixing currencies', () => {
      const result = cents(1000, 'COP').add(cents(500, 'USD'));

      expect(result.ok).toBe(false);
      expect(result.ok ? null : result.error).toBeInstanceOf(CurrencyMismatchError);
    });
  });

  describe('multiply', () => {
    it('scales the amount by a whole factor', () => {
      const result = cents(2500).multiply(3);

      expect(result.ok && result.value.amountInCents).toBe(7500);
    });

    it('supports multiplying by zero', () => {
      const result = cents(2500).multiply(0);

      expect(result.ok && result.value.amountInCents).toBe(0);
    });

    it('rejects a negative factor', () => {
      expect(cents(2500).multiply(-1).ok).toBe(false);
    });

    it('rejects a fractional factor', () => {
      expect(cents(2500).multiply(1.5).ok).toBe(false);
    });
  });

  describe('equals', () => {
    it('is true for the same amount and currency', () => {
      expect(cents(100).equals(cents(100))).toBe(true);
    });

    it('is false for a different amount', () => {
      expect(cents(100).equals(cents(200))).toBe(false);
    });

    it('is false for a different currency', () => {
      expect(cents(100, 'COP').equals(cents(100, 'USD'))).toBe(false);
    });
  });
});
