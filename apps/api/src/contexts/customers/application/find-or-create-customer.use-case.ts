import { Inject, Injectable } from '@nestjs/common';

import { Customer } from '@/contexts/customers/domain/customer';
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from '@/contexts/customers/domain/ports/customer.repository';
import { Email } from '@/contexts/customers/domain/value-objects';
import { type IdGenerator, ID_GENERATOR } from '@/shared/application/ports/id-generator.port';
import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { andThenAsync, type AsyncResult } from '@/shared/domain/result';

export interface CustomerDetails {
  email: string;
  fullName: string;
  phoneNumber: string;
  legalIdType?: string | null;
  legalIdNumber?: string | null;
}

@Injectable()
export class FindOrCreateCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(details: CustomerDetails, context?: TransactionContext): AsyncResult<Customer, DomainError> {
    return andThenAsync(Email.create(details.email), async (email) => {
      const existing = await this.customers.findByEmail(email.value, context);

      return andThenAsync(existing, (found) => {
        const customer = found
          ? found.withUpdatedDetails(details)
          : Customer.create({ ...details, id: this.ids.generate() });

        return andThenAsync(customer, (value) => this.customers.save(value, context));
      });
    });
  }
}
