import { type DomainError } from '@/shared/domain/domain-error';
import { err, ok, type Result } from '@/shared/domain/result';

import { InsufficientStockError, InvalidQuantityError, InvalidStockOperationError } from './errors';

export interface StockSnapshot {
  productId: string;
  availableUnits: number;
  reservedUnits: number;
  version: number;
}

const isPositiveInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

export class Stock {
  private constructor(
    readonly productId: string,
    readonly availableUnits: number,
    readonly reservedUnits: number,
    readonly version: number,
  ) {}

  static rehydrate(snapshot: StockSnapshot): Stock {
    return new Stock(
      snapshot.productId,
      snapshot.availableUnits,
      snapshot.reservedUnits,
      snapshot.version,
    );
  }

  canFulfil(units: number): boolean {
    return isPositiveInteger(units) && this.availableUnits >= units;
  }

  reserve(units: number): Result<Stock, DomainError> {
    if (!isPositiveInteger(units)) {
      return err(new InvalidQuantityError(units));
    }
    if (this.availableUnits < units) {
      return err(new InsufficientStockError(this.productId, units, this.availableUnits));
    }
    return ok(
      new Stock(
        this.productId,
        this.availableUnits - units,
        this.reservedUnits + units,
        this.version,
      ),
    );
  }

  confirmReservation(units: number): Result<Stock, DomainError> {
    const guard = this.guardReserved(units);
    if (!guard.ok) {
      return guard;
    }
    return ok(
      new Stock(this.productId, this.availableUnits, this.reservedUnits - units, this.version),
    );
  }

  releaseReservation(units: number): Result<Stock, DomainError> {
    const guard = this.guardReserved(units);
    if (!guard.ok) {
      return guard;
    }
    return ok(
      new Stock(
        this.productId,
        this.availableUnits + units,
        this.reservedUnits - units,
        this.version,
      ),
    );
  }

  toSnapshot(): StockSnapshot {
    return {
      productId: this.productId,
      availableUnits: this.availableUnits,
      reservedUnits: this.reservedUnits,
      version: this.version,
    };
  }

  private guardReserved(units: number): Result<void, DomainError> {
    if (!isPositiveInteger(units)) {
      return err(new InvalidQuantityError(units));
    }
    if (this.reservedUnits < units) {
      return err(
        new InvalidStockOperationError(
          this.productId,
          'No hay unidades reservadas suficientes para completar la operación.',
        ),
      );
    }
    return ok(undefined);
  }
}
