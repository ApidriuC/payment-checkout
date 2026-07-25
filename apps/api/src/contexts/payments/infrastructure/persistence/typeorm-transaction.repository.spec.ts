import { AmountBreakdown } from '@/contexts/payments/domain/amount-breakdown';
import { CardBrand, CardSummary } from '@/contexts/payments/domain/card-summary';
import { PaymentTransaction } from '@/contexts/payments/domain/payment-transaction';
import { TransactionEventSource } from '@/contexts/payments/domain/ports/transaction.repository';
import { TransactionStatus } from '@/contexts/payments/domain/transaction-status';
import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';
import { Money } from '@/shared/domain/money';
import { fakeDataSource } from '@test/fakes/fake-data-source';

import { TransactionEventOrmEntity } from './transaction-event.orm-entity';
import { TransactionOrmEntity } from './transaction.orm-entity';
import { TypeOrmTransactionRepository } from './typeorm-transaction.repository';

const CREATED_AT = new Date('2026-07-24T12:00:00.000Z');

const money = (cents: number): Money => {
  const result = Money.fromCents(cents);
  if (!result.ok) throw new Error('fixture');
  return result.value;
};

const transactionRow = (overrides: Partial<TransactionOrmEntity> = {}): TransactionOrmEntity =>
  ({
    id: 'transaction-1',
    reference: 'TX-REF-1',
    customerId: 'customer-1',
    productId: 'product-1',
    quantity: 2,
    productAmountInCents: 91980000,
    baseFeeInCents: 500000,
    deliveryFeeInCents: 1000000,
    totalAmountInCents: 93480000,
    currency: 'COP',
    status: TransactionStatus.PENDING,
    gatewayTransactionId: null,
    gatewayStatus: null,
    failureReason: null,
    cardBrand: null,
    cardLastFour: null,
    createdAt: CREATED_AT,
    completedAt: null,
    ...overrides,
  }) as TransactionOrmEntity;

const domainTransaction = (): PaymentTransaction => {
  const breakdown = AmountBreakdown.create(money(91980000), money(500000), money(1000000));
  if (!breakdown.ok) throw new Error('fixture');

  return PaymentTransaction.create({
    id: 'transaction-1',
    reference: 'TX-REF-1',
    customerId: 'customer-1',
    productId: 'product-1',
    quantity: 2,
    amounts: breakdown.value,
    createdAt: CREATED_AT,
  });
};

let CONTEXT: TransactionContext;

const setup = () => {
  const { dataSource, context, repositoryFor } = fakeDataSource();
  CONTEXT = context;

  return {
    repository: new TypeOrmTransactionRepository(dataSource),
    transactions: repositoryFor(TransactionOrmEntity),
    events: repositoryFor(TransactionEventOrmEntity),
  };
};

describe('TypeOrmTransactionRepository', () => {
  describe('findByReference', () => {
    it('rebuilds the transaction with its amount breakdown', async () => {
      const { repository, transactions } = setup();
      transactions.findOne.mockResolvedValue(transactionRow());

      const result = await repository.findByReference('TX-REF-1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.amounts.total.amountInCents).toBe(93480000);
      expect(result.value.status).toBe(TransactionStatus.PENDING);
    });

    it('rebuilds the card summary when present', async () => {
      const { repository, transactions } = setup();
      transactions.findOne.mockResolvedValue(
        transactionRow({ cardBrand: CardBrand.VISA, cardLastFour: '4242' }),
      );

      const result = await repository.findByReference('TX-REF-1');

      expect(result.ok && result.value.card?.brand).toBe(CardBrand.VISA);
    });

    it('fails for an unknown reference', async () => {
      const { repository, transactions } = setup();
      transactions.findOne.mockResolvedValue(null);

      const result = await repository.findByReference('TX-MISSING');

      expect(result.ok ? null : result.error.code).toBe('TRANSACTION_NOT_FOUND');
    });

    it('turns a driver failure into a domain error', async () => {
      const { repository, transactions } = setup();
      transactions.findOne.mockRejectedValue(new Error('boom'));

      const result = await repository.findByReference('TX-REF-1');

      expect(result.ok ? null : result.error.code).toBe('UNEXPECTED_ERROR');
    });
  });

  describe('lockByReference', () => {
    it('requests a pessimistic write lock', async () => {
      const { repository, transactions } = setup();
      transactions.findOne.mockResolvedValue(transactionRow());

      await repository.lockByReference('TX-REF-1', CONTEXT);

      expect(transactions.findOne).toHaveBeenCalledWith({
        where: { reference: 'TX-REF-1' },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('fails for an unknown reference', async () => {
      const { repository, transactions } = setup();
      transactions.findOne.mockResolvedValue(null);

      const result = await repository.lockByReference('TX-MISSING', CONTEXT);

      expect(result.ok ? null : result.error.code).toBe('TRANSACTION_NOT_FOUND');
    });

    it('turns a lock failure into a domain error', async () => {
      const { repository, transactions } = setup();
      transactions.findOne.mockRejectedValue(new Error('deadlock'));

      const result = await repository.lockByReference('TX-REF-1', CONTEXT);

      expect(result.ok ? null : result.error.code).toBe('UNEXPECTED_ERROR');
    });
  });

  describe('save', () => {
    it('writes the derived total alongside the breakdown', async () => {
      const { repository, transactions } = setup();
      transactions.save.mockResolvedValue({});

      await repository.save(domainTransaction());

      expect(transactions.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'TX-REF-1',
          productAmountInCents: 91980000,
          baseFeeInCents: 500000,
          deliveryFeeInCents: 1000000,
          totalAmountInCents: 93480000,
        }),
      );
    });

    it('never writes anything beyond the card brand and last four digits', async () => {
      const { repository, transactions } = setup();
      transactions.save.mockResolvedValue({});

      const card = CardSummary.create('VISA', '4242');
      if (!card.ok) throw new Error('fixture');
      const withCard = domainTransaction().withCard(card.value);
      if (!withCard.ok) throw new Error('fixture');

      await repository.save(withCard.value);

      const written = (transactions.save.mock.calls as unknown[][])[0][0] as Record<string, unknown>;
      expect(written.cardBrand).toBe(CardBrand.VISA);
      expect(written.cardLastFour).toBe('4242');
      expect(Object.keys(written)).not.toContain('cardNumber');
    });

    it('turns a write failure into a domain error', async () => {
      const { repository, transactions } = setup();
      transactions.save.mockRejectedValue(new Error('boom'));

      const result = await repository.save(domainTransaction());

      expect(result.ok ? null : result.error.code).toBe('UNEXPECTED_ERROR');
    });
  });

  describe('recordEvent', () => {
    it('appends the status change to the log', async () => {
      const { repository, events } = setup();
      events.save.mockResolvedValue({});

      const result = await repository.recordEvent({
        transactionId: 'transaction-1',
        fromStatus: TransactionStatus.PENDING,
        toStatus: TransactionStatus.APPROVED,
        source: TransactionEventSource.GATEWAY_WEBHOOK,
        payload: { transaction: { id: 'gw-1' } },
      });

      expect(result.ok).toBe(true);
      expect(events.save).toHaveBeenCalledWith({
        transactionId: 'transaction-1',
        fromStatus: TransactionStatus.PENDING,
        toStatus: TransactionStatus.APPROVED,
        source: TransactionEventSource.GATEWAY_WEBHOOK,
        payload: { transaction: { id: 'gw-1' } },
      });
    });

    it('stores a null payload when none was provided', async () => {
      const { repository, events } = setup();
      events.save.mockResolvedValue({});

      await repository.recordEvent({
        transactionId: 'transaction-1',
        fromStatus: TransactionStatus.PENDING,
        toStatus: TransactionStatus.PENDING,
        source: TransactionEventSource.API,
      });

      expect((events.save.mock.calls as unknown[][])[0][0]).toMatchObject({ payload: null });
    });

    it('turns a write failure into a domain error', async () => {
      const { repository, events } = setup();
      events.save.mockRejectedValue(new Error('boom'));

      const result = await repository.recordEvent({
        transactionId: 'transaction-1',
        fromStatus: TransactionStatus.PENDING,
        toStatus: TransactionStatus.APPROVED,
        source: TransactionEventSource.API,
      });

      expect(result.ok ? null : result.error.code).toBe('UNEXPECTED_ERROR');
    });
  });
});
