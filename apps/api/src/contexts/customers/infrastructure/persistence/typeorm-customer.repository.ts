import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { Customer } from '@/contexts/customers/domain/customer';
import { CustomerNotFoundError } from '@/contexts/customers/domain/errors';
import { type CustomerRepository } from '@/contexts/customers/domain/ports/customer.repository';
import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError, UnexpectedError } from '@/shared/domain/domain-error';
import { type AsyncResult, err, fromPromise, ok, type Result } from '@/shared/domain/result';
import { managerFrom } from '@/shared/infrastructure/persistence/typeorm/typeorm-unit-of-work';

import { CustomerOrmEntity } from './customer.orm-entity';

@Injectable()
export class TypeOrmCustomerRepository implements CustomerRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findById(id: string, context?: TransactionContext): AsyncResult<Customer, DomainError> {
    const row = await fromPromise(
      managerFrom(this.dataSource, context)
        .getRepository(CustomerOrmEntity)
        .findOne({ where: { id } }),
      (cause) => new UnexpectedError('No se pudo consultar el cliente.', cause),
    );

    if (!row.ok) {
      return row;
    }
    if (!row.value) {
      return err(new CustomerNotFoundError(id));
    }

    return this.toDomain(row.value);
  }

  async findByEmail(
    email: string,
    context?: TransactionContext,
  ): AsyncResult<Customer | null, DomainError> {
    const row = await fromPromise(
      managerFrom(this.dataSource, context)
        .getRepository(CustomerOrmEntity)
        .findOne({ where: { email } }),
      (cause) => new UnexpectedError('No se pudo consultar el cliente.', cause),
    );

    if (!row.ok) {
      return row;
    }
    if (!row.value) {
      return ok(null);
    }

    return this.toDomain(row.value);
  }

  async save(customer: Customer, context?: TransactionContext): AsyncResult<Customer, DomainError> {
    const saved = await fromPromise(
      managerFrom(this.dataSource, context)
        .getRepository(CustomerOrmEntity)
        .save({
          id: customer.id,
          email: customer.email.value,
          fullName: customer.fullName.value,
          phoneNumber: customer.phoneNumber.value,
          legalIdType: (customer.legalId?.type ?? null),
          legalId: customer.legalId?.number ?? null,
        }),
      (cause) => new UnexpectedError('No se pudo guardar el cliente.', cause),
    );

    if (!saved.ok) {
      return saved;
    }

    return ok(customer);
  }

  private toDomain(row: CustomerOrmEntity): Result<Customer, DomainError> {
    return Customer.create({
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      phoneNumber: row.phoneNumber,
      legalIdType: row.legalIdType,
      legalIdNumber: row.legalId,
    });
  }
}
