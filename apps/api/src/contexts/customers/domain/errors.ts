import { DomainError, DomainErrorKind } from '@/shared/domain/domain-error';

export class InvalidEmailError extends DomainError {
  readonly code = 'INVALID_EMAIL';
  readonly kind = DomainErrorKind.Validation;

  constructor() {
    super('El correo electrónico no tiene un formato válido.');
  }
}

export class InvalidCustomerNameError extends DomainError {
  readonly code = 'INVALID_CUSTOMER_NAME';
  readonly kind = DomainErrorKind.Validation;

  constructor() {
    super('El nombre debe tener entre 3 y 160 caracteres.');
  }
}

export class InvalidPhoneNumberError extends DomainError {
  readonly code = 'INVALID_PHONE_NUMBER';
  readonly kind = DomainErrorKind.Validation;

  constructor() {
    super('El teléfono debe tener entre 7 y 15 dígitos, con prefijo internacional opcional.');
  }
}

export class InvalidLegalIdError extends DomainError {
  readonly code = 'INVALID_LEGAL_ID';
  readonly kind = DomainErrorKind.Validation;

  constructor() {
    super('El documento de identidad no tiene un formato válido.');
  }
}

export class CustomerNotFoundError extends DomainError {
  readonly code = 'CUSTOMER_NOT_FOUND';
  readonly kind = DomainErrorKind.NotFound;

  constructor(customerId: string) {
    super('El cliente solicitado no existe.', { customerId });
  }
}
