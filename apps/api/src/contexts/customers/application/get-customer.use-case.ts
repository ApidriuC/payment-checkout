import { Inject, Injectable } from '@nestjs/common';

import { type Customer } from '@/contexts/customers/domain/customer';
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from '@/contexts/customers/domain/ports/customer.repository';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult } from '@/shared/domain/result';

@Injectable()
export class GetCustomerUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository) {}

  execute(customerId: string): AsyncResult<Customer, DomainError> {
    return this.customers.findById(customerId);
  }
}
