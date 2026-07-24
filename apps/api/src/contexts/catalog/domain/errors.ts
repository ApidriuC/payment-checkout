import { DomainError, DomainErrorKind } from '@/shared/domain/domain-error';

export class ProductNotFoundError extends DomainError {
  readonly code = 'PRODUCT_NOT_FOUND';
  readonly kind = DomainErrorKind.NotFound;

  constructor(productId: string) {
    super('El producto solicitado no existe.', { productId });
  }
}

export class StockNotFoundError extends DomainError {
  readonly code = 'STOCK_NOT_FOUND';
  readonly kind = DomainErrorKind.NotFound;

  constructor(productId: string) {
    super('El producto no tiene stock registrado.', { productId });
  }
}

export class InsufficientStockError extends DomainError {
  readonly code = 'INSUFFICIENT_STOCK';
  readonly kind = DomainErrorKind.Conflict;

  constructor(productId: string, requested: number, available: number) {
    super('No hay unidades suficientes disponibles.', { productId, requested, available });
  }
}

export class InvalidQuantityError extends DomainError {
  readonly code = 'INVALID_QUANTITY';
  readonly kind = DomainErrorKind.Validation;

  constructor(quantity: number) {
    super('La cantidad debe ser un entero mayor que cero.', { quantity });
  }
}

export class StockConcurrencyError extends DomainError {
  readonly code = 'STOCK_CONCURRENCY_CONFLICT';
  readonly kind = DomainErrorKind.Conflict;

  constructor(productId: string) {
    super('El stock cambió mientras se procesaba la compra. Intenta de nuevo.', { productId });
  }
}

export class InvalidStockOperationError extends DomainError {
  readonly code = 'INVALID_STOCK_OPERATION';
  readonly kind = DomainErrorKind.Conflict;

  constructor(productId: string, reason: string) {
    super(reason, { productId });
  }
}
