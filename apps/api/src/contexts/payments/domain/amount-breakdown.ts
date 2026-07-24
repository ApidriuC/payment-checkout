import { type DomainError } from '@/shared/domain/domain-error';
import { type Money } from '@/shared/domain/money';
import { andThen, map, type Result } from '@/shared/domain/result';

export class AmountBreakdown {
  private constructor(
    readonly productAmount: Money,
    readonly baseFee: Money,
    readonly deliveryFee: Money,
    readonly total: Money,
  ) {}

  static create(
    productAmount: Money,
    baseFee: Money,
    deliveryFee: Money,
  ): Result<AmountBreakdown, DomainError> {
    return andThen(productAmount.add(baseFee), (subtotal) =>
      map(
        subtotal.add(deliveryFee),
        (total) => new AmountBreakdown(productAmount, baseFee, deliveryFee, total),
      ),
    );
  }

  get currency(): string {
    return this.total.currency;
  }
}
