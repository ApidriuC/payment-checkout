import { Money } from '@/shared/domain/money';

import { AmountBreakdown } from './amount-breakdown';
import { CardBrand, CardSummary } from './card-summary';
import { TransactionAlreadyFinalizedError } from './errors';
import { PaymentTransaction, type TransactionSnapshot } from './payment-transaction';
import { TransactionStatus } from './transaction-status';

const CREATED_AT = new Date('2026-07-24T12:00:00.000Z');
const COMPLETED_AT = new Date('2026-07-24T12:00:05.000Z');

const money = (cents: number): Money => {
  const result = Money.fromCents(cents);
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const breakdown = (): AmountBreakdown => {
  const result = AmountBreakdown.create(money(45990000), money(500000), money(1000000));
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const pending = (): PaymentTransaction =>
  PaymentTransaction.create({
    id: 'f1e2d3c4-b5a6-4978-8899-aabbccddeeff',
    reference: 'TX-ABC123',
    customerId: 'd1e2f3a4-b5c6-4d7e-8f90-1a2b3c4d5e6f',
    productId: 'c737db54-a942-4c9b-894e-b29ecbf825b1',
    quantity: 1,
    amounts: breakdown(),
    createdAt: CREATED_AT,
  });

const card = (): CardSummary => {
  const result = CardSummary.create('VISA', '4242');
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

describe('AmountBreakdown', () => {
  it('totals the product amount plus both fees', () => {
    expect(breakdown().total.amountInCents).toBe(47490000);
  });

  it('exposes the shared currency', () => {
    expect(breakdown().currency).toBe('COP');
  });

  it('fails when the fees use another currency', () => {
    const foreignFee = Money.fromCents(500000, 'USD');
    if (!foreignFee.ok) throw new Error('fixture');

    expect(AmountBreakdown.create(money(1000), foreignFee.value, money(100)).ok).toBe(false);
  });
});

describe('CardSummary', () => {
  it.each([
    ['visa', CardBrand.VISA],
    ['MASTERCARD', CardBrand.MASTERCARD],
    ['Master Card', CardBrand.MASTERCARD],
    ['AMEX', CardBrand.UNKNOWN],
  ])('normalizes brand %p', (raw, expected) => {
    const result = CardSummary.create(raw, '4242');

    expect(result.ok && result.value.brand).toBe(expected);
  });

  it.each(['424', '42424', 'abcd', ''])('rejects last four %p', (lastFour) => {
    expect(CardSummary.create('VISA', lastFour).ok).toBe(false);
  });
});

describe('PaymentTransaction', () => {
  describe('create', () => {
    it('starts pending with no gateway data', () => {
      const transaction = pending();

      expect(transaction.status).toBe(TransactionStatus.PENDING);
      expect(transaction.isFinalized).toBe(false);
      expect(transaction.gatewayTransactionId).toBeNull();
      expect(transaction.card).toBeNull();
      expect(transaction.completedAt).toBeNull();
    });

    it('keeps the totals from the breakdown', () => {
      expect(pending().amounts.total.amountInCents).toBe(47490000);
    });
  });

  describe('withCard', () => {
    it('attaches the card summary', () => {
      const result = pending().withCard(card());

      expect(result.ok && result.value.card?.lastFour).toBe('4242');
    });
  });

  describe('applyGatewayOutcome', () => {
    it.each([
      ['APPROVED', TransactionStatus.APPROVED],
      ['DECLINED', TransactionStatus.DECLINED],
      ['VOIDED', TransactionStatus.VOIDED],
      ['ERROR', TransactionStatus.ERROR],
    ])('maps gateway status %p', (gatewayStatus, expected) => {
      const result = pending().applyGatewayOutcome(
        { gatewayTransactionId: 'gw-1', gatewayStatus },
        COMPLETED_AT,
      );

      expect(result.ok && result.value.status).toBe(expected);
    });

    it('is case and whitespace insensitive', () => {
      const result = pending().applyGatewayOutcome(
        { gatewayTransactionId: 'gw-1', gatewayStatus: '  approved ' },
        COMPLETED_AT,
      );

      expect(result.ok && result.value.status).toBe(TransactionStatus.APPROVED);
    });

    it('falls back to ERROR on an unknown gateway status', () => {
      const result = pending().applyGatewayOutcome(
        { gatewayTransactionId: 'gw-1', gatewayStatus: 'WHAT_IS_THIS' },
        COMPLETED_AT,
      );

      expect(result.ok && result.value.status).toBe(TransactionStatus.ERROR);
    });

    it('stamps the completion time for a final status', () => {
      const result = pending().applyGatewayOutcome(
        { gatewayTransactionId: 'gw-1', gatewayStatus: 'APPROVED' },
        COMPLETED_AT,
      );

      expect(result.ok && result.value.completedAt).toEqual(COMPLETED_AT);
    });

    it('leaves the completion time empty while the gateway is still pending', () => {
      const result = pending().applyGatewayOutcome(
        { gatewayTransactionId: 'gw-1', gatewayStatus: 'PENDING' },
        COMPLETED_AT,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe(TransactionStatus.PENDING);
        expect(result.value.completedAt).toBeNull();
      }
    });

    it('stores the failure reason', () => {
      const result = pending().applyGatewayOutcome(
        {
          gatewayTransactionId: 'gw-1',
          gatewayStatus: 'DECLINED',
          failureReason: 'Fondos insuficientes',
        },
        COMPLETED_AT,
      );

      expect(result.ok && result.value.failureReason).toBe('Fondos insuficientes');
    });

    it('refuses to overwrite a transaction that already finished', () => {
      const approved = pending().applyGatewayOutcome(
        { gatewayTransactionId: 'gw-1', gatewayStatus: 'APPROVED' },
        COMPLETED_AT,
      );
      if (!approved.ok) throw new Error('fixture');

      const second = approved.value.applyGatewayOutcome(
        { gatewayTransactionId: 'gw-2', gatewayStatus: 'DECLINED' },
        COMPLETED_AT,
      );

      expect(second.ok).toBe(false);
      expect(second.ok ? null : second.error).toBeInstanceOf(TransactionAlreadyFinalizedError);
    });

    it('does not mutate the original transaction', () => {
      const transaction = pending();

      transaction.applyGatewayOutcome(
        { gatewayTransactionId: 'gw-1', gatewayStatus: 'APPROVED' },
        COMPLETED_AT,
      );

      expect(transaction.status).toBe(TransactionStatus.PENDING);
    });
  });

  describe('markAsFailed', () => {
    it('moves the transaction to ERROR with the reason', () => {
      const result = pending().markAsFailed('Timeout de la pasarela', COMPLETED_AT);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe(TransactionStatus.ERROR);
        expect(result.value.failureReason).toBe('Timeout de la pasarela');
        expect(result.value.completedAt).toEqual(COMPLETED_AT);
      }
    });

    it('refuses to fail an already finalized transaction', () => {
      const approved = pending().applyGatewayOutcome(
        { gatewayTransactionId: 'gw-1', gatewayStatus: 'APPROVED' },
        COMPLETED_AT,
      );
      if (!approved.ok) throw new Error('fixture');

      expect(approved.value.markAsFailed('tarde', COMPLETED_AT).ok).toBe(false);
    });
  });

  describe('snapshot round trip', () => {
    it('rehydrates into an equivalent transaction', () => {
      const withCardResult = pending().withCard(card());
      if (!withCardResult.ok) throw new Error('fixture');

      const snapshot = withCardResult.value.toSnapshot();
      const restored = PaymentTransaction.rehydrate(snapshot);

      expect(restored.ok).toBe(true);
      if (restored.ok) {
        expect(restored.value.toSnapshot()).toEqual(snapshot);
      }
    });

    it('rehydrates a transaction without card data', () => {
      const snapshot = pending().toSnapshot();

      const restored = PaymentTransaction.rehydrate(snapshot);

      expect(restored.ok && restored.value.card).toBeNull();
    });

    it('fails when the stored amounts are invalid', () => {
      const snapshot: TransactionSnapshot = { ...pending().toSnapshot(), baseFeeInCents: -1 };

      expect(PaymentTransaction.rehydrate(snapshot).ok).toBe(false);
    });
  });
});
