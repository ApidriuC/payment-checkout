import { type DomainError } from '@/shared/domain/domain-error';
import { Money } from '@/shared/domain/money';
import { andThen, err, map, ok, type Result } from '@/shared/domain/result';

import { AmountBreakdown } from './amount-breakdown';
import { CardSummary } from './card-summary';
import { TransactionAlreadyFinalizedError } from './errors';
import { isFinal, TransactionStatus } from './transaction-status';

export interface GatewayOutcome {
  gatewayTransactionId: string;
  gatewayStatus: string;
  failureReason?: string | null;
}

export interface TransactionSnapshot {
  id: string;
  reference: string;
  customerId: string;
  productId: string;
  quantity: number;
  productAmountInCents: number;
  baseFeeInCents: number;
  deliveryFeeInCents: number;
  currency: string;
  status: TransactionStatus;
  gatewayTransactionId: string | null;
  gatewayStatus: string | null;
  failureReason: string | null;
  cardBrand: string | null;
  cardLastFour: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface NewTransaction {
  id: string;
  reference: string;
  customerId: string;
  productId: string;
  quantity: number;
  amounts: AmountBreakdown;
  createdAt: Date;
}

interface TransactionProps {
  id: string;
  reference: string;
  customerId: string;
  productId: string;
  quantity: number;
  amounts: AmountBreakdown;
  status: TransactionStatus;
  gatewayTransactionId: string | null;
  gatewayStatus: string | null;
  failureReason: string | null;
  card: CardSummary | null;
  createdAt: Date;
  completedAt: Date | null;
}

const STATUS_BY_GATEWAY_STATUS: Record<string, TransactionStatus> = {
  APPROVED: TransactionStatus.APPROVED,
  DECLINED: TransactionStatus.DECLINED,
  VOIDED: TransactionStatus.VOIDED,
  ERROR: TransactionStatus.ERROR,
  PENDING: TransactionStatus.PENDING,
};

export class PaymentTransaction {
  private constructor(private readonly props: TransactionProps) {}

  static create(input: NewTransaction): PaymentTransaction {
    return new PaymentTransaction({
      ...input,
      status: TransactionStatus.PENDING,
      gatewayTransactionId: null,
      gatewayStatus: null,
      failureReason: null,
      card: null,
      completedAt: null,
    });
  }

  static rehydrate(snapshot: TransactionSnapshot): Result<PaymentTransaction, DomainError> {
    const amounts = andThen(Money.fromCents(snapshot.productAmountInCents, snapshot.currency), (product) =>
      andThen(Money.fromCents(snapshot.baseFeeInCents, snapshot.currency), (base) =>
        andThen(Money.fromCents(snapshot.deliveryFeeInCents, snapshot.currency), (delivery) =>
          AmountBreakdown.create(product, base, delivery),
        ),
      ),
    );

    return andThen(amounts, (breakdown) =>
      map(PaymentTransaction.rehydrateCard(snapshot), (card) => {
        return new PaymentTransaction({
          id: snapshot.id,
          reference: snapshot.reference,
          customerId: snapshot.customerId,
          productId: snapshot.productId,
          quantity: snapshot.quantity,
          amounts: breakdown,
          status: snapshot.status,
          gatewayTransactionId: snapshot.gatewayTransactionId,
          gatewayStatus: snapshot.gatewayStatus,
          failureReason: snapshot.failureReason,
          card,
          createdAt: snapshot.createdAt,
          completedAt: snapshot.completedAt,
        });
      }),
    );
  }

  get id(): string {
    return this.props.id;
  }

  get reference(): string {
    return this.props.reference;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get productId(): string {
    return this.props.productId;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get amounts(): AmountBreakdown {
    return this.props.amounts;
  }

  get status(): TransactionStatus {
    return this.props.status;
  }

  get card(): CardSummary | null {
    return this.props.card;
  }

  get gatewayTransactionId(): string | null {
    return this.props.gatewayTransactionId;
  }

  get gatewayStatus(): string | null {
    return this.props.gatewayStatus;
  }

  get failureReason(): string | null {
    return this.props.failureReason;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get completedAt(): Date | null {
    return this.props.completedAt;
  }

  get isFinalized(): boolean {
    return isFinal(this.props.status);
  }

  withCard(card: CardSummary): Result<PaymentTransaction, DomainError> {
    return this.guardPending(() => new PaymentTransaction({ ...this.props, card }));
  }

  /**
   * Maps the gateway's own status onto the domain status. An unknown status is
   * treated as ERROR so an unexpected gateway response never leaves the
   * transaction stuck in PENDING.
   */
  applyGatewayOutcome(outcome: GatewayOutcome, at: Date): Result<PaymentTransaction, DomainError> {
    return this.guardPending(() => {
      const status =
        STATUS_BY_GATEWAY_STATUS[outcome.gatewayStatus.trim().toUpperCase()] ??
        TransactionStatus.ERROR;

      return new PaymentTransaction({
        ...this.props,
        status,
        gatewayTransactionId: outcome.gatewayTransactionId,
        gatewayStatus: outcome.gatewayStatus,
        failureReason: outcome.failureReason ?? null,
        completedAt: isFinal(status) ? at : null,
      });
    });
  }

  markAsFailed(reason: string, at: Date): Result<PaymentTransaction, DomainError> {
    return this.guardPending(
      () =>
        new PaymentTransaction({
          ...this.props,
          status: TransactionStatus.ERROR,
          failureReason: reason,
          completedAt: at,
        }),
    );
  }

  toSnapshot(): TransactionSnapshot {
    return {
      id: this.props.id,
      reference: this.props.reference,
      customerId: this.props.customerId,
      productId: this.props.productId,
      quantity: this.props.quantity,
      productAmountInCents: this.props.amounts.productAmount.amountInCents,
      baseFeeInCents: this.props.amounts.baseFee.amountInCents,
      deliveryFeeInCents: this.props.amounts.deliveryFee.amountInCents,
      currency: this.props.amounts.currency,
      status: this.props.status,
      gatewayTransactionId: this.props.gatewayTransactionId,
      gatewayStatus: this.props.gatewayStatus,
      failureReason: this.props.failureReason,
      cardBrand: this.props.card?.brand ?? null,
      cardLastFour: this.props.card?.lastFour ?? null,
      createdAt: this.props.createdAt,
      completedAt: this.props.completedAt,
    };
  }

  private guardPending(
    build: () => PaymentTransaction,
  ): Result<PaymentTransaction, DomainError> {
    if (this.isFinalized) {
      return err(new TransactionAlreadyFinalizedError(this.props.reference, this.props.status));
    }
    return ok(build());
  }

  private static rehydrateCard(
    snapshot: TransactionSnapshot,
  ): Result<CardSummary | null, DomainError> {
    if (!snapshot.cardBrand || !snapshot.cardLastFour) {
      return ok(null);
    }
    return CardSummary.create(snapshot.cardBrand, snapshot.cardLastFour);
  }
}
