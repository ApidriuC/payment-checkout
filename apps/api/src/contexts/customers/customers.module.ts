import { Module } from '@nestjs/common';

import { FindOrCreateCustomerUseCase } from './application/find-or-create-customer.use-case';
import { GetCustomerUseCase } from './application/get-customer.use-case';
import { CUSTOMER_REPOSITORY } from './domain/ports/customer.repository';
import { CustomersController } from './infrastructure/http/customers.controller';
import { TypeOrmCustomerRepository } from './infrastructure/persistence/typeorm-customer.repository';

@Module({
  controllers: [CustomersController],
  providers: [
    GetCustomerUseCase,
    FindOrCreateCustomerUseCase,
    { provide: CUSTOMER_REPOSITORY, useClass: TypeOrmCustomerRepository },
  ],
  exports: [FindOrCreateCustomerUseCase, CUSTOMER_REPOSITORY],
})
export class CustomersModule {}
