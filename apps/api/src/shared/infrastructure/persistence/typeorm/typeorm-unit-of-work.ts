import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

import {
  type TransactionContext,
  type UnitOfWork,
} from '@/shared/application/ports/unit-of-work.port';
import { type DomainError, UnexpectedError } from '@/shared/domain/domain-error';
import { type AsyncResult, err, type Result } from '@/shared/domain/result';

class Rollback<T> extends Error {
  constructor(readonly result: Result<T, DomainError>) {
    super('rollback');
  }
}

export const managerFrom = (
  dataSource: DataSource,
  context?: TransactionContext,
): EntityManager =>
  context ? (context as unknown as EntityManager) : dataSource.manager;

@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async run<T>(
    work: (context: TransactionContext) => AsyncResult<T, DomainError>,
  ): AsyncResult<T, DomainError> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const result = await work(manager as unknown as TransactionContext);

        // A failure on the railway must undo everything written so far.
        if (!result.ok) {
          throw new Rollback(result);
        }

        return result;
      });
    } catch (cause) {
      if (cause instanceof Rollback) {
        return cause.result as Result<T, DomainError>;
      }
      return err(new UnexpectedError('La operación no pudo completarse.', cause));
    }
  }
}
