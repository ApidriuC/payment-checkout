import { type DataSource } from 'typeorm';

import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';

export interface FakeRepository {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
}

const buildRepository = (): FakeRepository => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

/**
 * Stands in for a TypeORM DataSource so repository adapters can be tested for
 * their mapping and error handling without a live database.
 */
export const fakeDataSource = () => {
  const repositories = new Map<unknown, FakeRepository>();

  const getRepository = jest.fn((entity: unknown) => {
    if (!repositories.has(entity)) {
      repositories.set(entity, buildRepository());
    }
    return repositories.get(entity);
  });

  const manager = { getRepository };
  const dataSource = { manager, getRepository } as unknown as DataSource;

  return {
    dataSource,
    // The unit of work hands the entity manager through as an opaque context.
    context: manager as unknown as TransactionContext,
    repositoryFor: (entity: unknown): FakeRepository => {
      if (!repositories.has(entity)) {
        repositories.set(entity, buildRepository());
      }
      return repositories.get(entity)!;
    },
  };
};
