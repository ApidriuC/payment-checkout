import { type DomainError } from '@/shared/domain/domain-error';
import { err, ok, type Result } from '@/shared/domain/result';

import {
  InvalidCustomerNameError,
  InvalidEmailError,
  InvalidLegalIdError,
  InvalidPhoneNumberError,
} from './errors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const PHONE_PATTERN = /^\+?\d{7,15}$/;
const LEGAL_ID_PATTERN = /^[A-Za-z0-9-]{5,20}$/;

export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<Email, DomainError> {
    const normalized = raw.trim().toLowerCase();

    if (normalized.length > 255 || !EMAIL_PATTERN.test(normalized)) {
      return err(new InvalidEmailError());
    }

    return ok(new Email(normalized));
  }
}

export class CustomerName {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<CustomerName, DomainError> {
    const normalized = raw.trim().replace(/\s+/g, ' ');

    if (normalized.length < 3 || normalized.length > 160) {
      return err(new InvalidCustomerNameError());
    }

    return ok(new CustomerName(normalized));
  }
}

export class PhoneNumber {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<PhoneNumber, DomainError> {
    const normalized = raw.replace(/[\s()-]/g, '');

    if (!PHONE_PATTERN.test(normalized)) {
      return err(new InvalidPhoneNumberError());
    }

    return ok(new PhoneNumber(normalized));
  }
}

export enum LegalIdType {
  CC = 'CC',
  CE = 'CE',
  NIT = 'NIT',
  PP = 'PP',
}

export class LegalId {
  private constructor(
    readonly type: LegalIdType,
    readonly number: string,
  ) {}

  static create(type: string, rawNumber: string): Result<LegalId, DomainError> {
    const normalizedType = type.trim().toUpperCase();
    const normalizedNumber = rawNumber.trim().replace(/[\s.]/g, '');

    if (!Object.values(LegalIdType).includes(normalizedType as LegalIdType)) {
      return err(new InvalidLegalIdError());
    }
    if (!LEGAL_ID_PATTERN.test(normalizedNumber)) {
      return err(new InvalidLegalIdError());
    }

    return ok(new LegalId(normalizedType as LegalIdType, normalizedNumber));
  }
}
