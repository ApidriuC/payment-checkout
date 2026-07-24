import { type DomainError } from '@/shared/domain/domain-error';
import { andThen, map, ok, type Result } from '@/shared/domain/result';

import { CustomerName, Email, LegalId, PhoneNumber } from './value-objects';

export interface CustomerInput {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  legalIdType?: string | null;
  legalIdNumber?: string | null;
}

export class Customer {
  private constructor(
    readonly id: string,
    readonly email: Email,
    readonly fullName: CustomerName,
    readonly phoneNumber: PhoneNumber,
    readonly legalId: LegalId | null,
  ) {}

  static create(input: CustomerInput): Result<Customer, DomainError> {
    return andThen(Email.create(input.email), (email) =>
      andThen(CustomerName.create(input.fullName), (fullName) =>
        andThen(PhoneNumber.create(input.phoneNumber), (phoneNumber) =>
          map(Customer.parseLegalId(input), (legalId) => {
            return new Customer(input.id, email, fullName, phoneNumber, legalId);
          }),
        ),
      ),
    );
  }

  /** Keeps the stored id and refreshes the contact details a returning buyer just typed. */
  withUpdatedDetails(input: Omit<CustomerInput, 'id'>): Result<Customer, DomainError> {
    return Customer.create({ ...input, id: this.id });
  }

  private static parseLegalId(input: CustomerInput): Result<LegalId | null, DomainError> {
    if (!input.legalIdType || !input.legalIdNumber) {
      return ok(null);
    }
    return LegalId.create(input.legalIdType, input.legalIdNumber);
  }
}
