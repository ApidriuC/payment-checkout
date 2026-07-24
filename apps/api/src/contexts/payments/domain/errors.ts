import { DomainError, DomainErrorKind } from '@/shared/domain/domain-error';

import { type TransactionStatus } from './transaction-status';

export class TransactionNotFoundError extends DomainError {
  readonly code = 'TRANSACTION_NOT_FOUND';
  readonly kind = DomainErrorKind.NotFound;

  constructor(reference: string) {
    super('La transacción solicitada no existe.', { reference });
  }
}

export class TransactionAlreadyFinalizedError extends DomainError {
  readonly code = 'TRANSACTION_ALREADY_FINALIZED';
  readonly kind = DomainErrorKind.Conflict;

  constructor(reference: string, status: TransactionStatus) {
    super('La transacción ya tiene un resultado final y no puede modificarse.', {
      reference,
      status,
    });
  }
}

export class InvalidCardSummaryError extends DomainError {
  readonly code = 'INVALID_CARD_SUMMARY';
  readonly kind = DomainErrorKind.Validation;

  constructor() {
    super('Los datos de la tarjeta no tienen un formato válido.');
  }
}

export class PaymentGatewayUnavailableError extends DomainError {
  readonly code = 'PAYMENT_GATEWAY_UNAVAILABLE';
  readonly kind = DomainErrorKind.Unavailable;

  constructor(detail: string) {
    super('No fue posible comunicarse con la pasarela de pagos.', { detail });
  }
}

export class PaymentGatewayRejectedError extends DomainError {
  readonly code = 'PAYMENT_GATEWAY_REJECTED';
  readonly kind = DomainErrorKind.Validation;

  constructor(detail: string) {
    super('La pasarela de pagos rechazó la solicitud.', { detail });
  }
}

export class InvalidWebhookSignatureError extends DomainError {
  readonly code = 'INVALID_WEBHOOK_SIGNATURE';
  readonly kind = DomainErrorKind.Validation;

  constructor() {
    super('La firma del evento recibido no es válida.');
  }
}
