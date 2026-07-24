import { DomainError, DomainErrorKind } from './domain-error';
import { err, ok, type Result } from './result';

export const DEFAULT_CURRENCY = 'COP';

export class InvalidMoneyAmountError extends DomainError {
  readonly code = 'INVALID_MONEY_AMOUNT';
  readonly kind = DomainErrorKind.Validation;

  constructor(amountInCents: number) {
    super('El importe debe ser un entero no negativo expresado en centavos.', { amountInCents });
  }
}

export class CurrencyMismatchError extends DomainError {
  readonly code = 'CURRENCY_MISMATCH';
  readonly kind = DomainErrorKind.Validation;

  constructor(left: string, right: string) {
    super('No se pueden operar importes en monedas distintas.', { left, right });
  }
}

export class Money {
  private constructor(
    readonly amountInCents: number,
    readonly currency: string,
  ) {}

  static fromCents(
    amountInCents: number,
    currency: string = DEFAULT_CURRENCY,
  ): Result<Money, DomainError> {
    if (!Number.isSafeInteger(amountInCents) || amountInCents < 0) {
      return err(new InvalidMoneyAmountError(amountInCents));
    }
    return ok(new Money(amountInCents, currency.toUpperCase()));
  }

  static zero(currency: string = DEFAULT_CURRENCY): Money {
    return new Money(0, currency.toUpperCase());
  }

  add(other: Money): Result<Money, DomainError> {
    if (other.currency !== this.currency) {
      return err(new CurrencyMismatchError(this.currency, other.currency));
    }
    return Money.fromCents(this.amountInCents + other.amountInCents, this.currency);
  }

  multiply(factor: number): Result<Money, DomainError> {
    if (!Number.isSafeInteger(factor) || factor < 0) {
      return err(new InvalidMoneyAmountError(factor));
    }
    return Money.fromCents(this.amountInCents * factor, this.currency);
  }

  equals(other: Money): boolean {
    return this.amountInCents === other.amountInCents && this.currency === other.currency;
  }
}
