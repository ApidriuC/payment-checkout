import { type DataSource } from 'typeorm';

import { DomainError, DomainErrorKind } from '@/shared/domain/domain-error';
import { err, ok } from '@/shared/domain/result';

import { managerFrom, TypeOrmUnitOfWork } from './typeorm-unit-of-work';

class TestError extends DomainError {
  readonly code = 'TEST_ERROR';
  readonly kind = DomainErrorKind.Conflict;

  constructor() {
    super('falló el paso');
  }
}

const setup = () => {
  const manager = { getRepository: jest.fn() };
  const transaction = jest.fn(async (work: (m: unknown) => Promise<unknown>) => work(manager));
  const dataSource = { transaction, manager } as unknown as DataSource;

  return { unitOfWork: new TypeOrmUnitOfWork(dataSource), transaction, manager };
};

describe('managerFrom', () => {
  it('uses the default manager when no context is given', () => {
    const manager = { getRepository: jest.fn() };
    const dataSource = { manager } as unknown as DataSource;

    expect(managerFrom(dataSource)).toBe(manager);
  });

  it('uses the context manager when one is given', () => {
    const dataSource = { manager: {} } as unknown as DataSource;
    const context = { getRepository: jest.fn() } as never;

    expect(managerFrom(dataSource, context)).toBe(context);
  });
});

describe('TypeOrmUnitOfWork', () => {
  it('returns the value produced inside the transaction', async () => {
    const { unitOfWork } = setup();

    const result = await unitOfWork.run(() => Promise.resolve(ok('listo')));

    expect(result).toEqual(ok('listo'));
  });

  it('hands the entity manager to the work as an opaque context', async () => {
    const { unitOfWork, manager } = setup();

    await unitOfWork.run((context) => {
      expect(context).toBe(manager);
      return Promise.resolve(ok(null));
    });
  });

  it('rolls back and forwards the domain error when a step fails', async () => {
    const { unitOfWork, transaction } = setup();
    const failure = new TestError();

    const result = await unitOfWork.run(() => Promise.resolve(err(failure)));

    expect(result).toEqual(err(failure));
    // The rollback happens by letting the driver's transaction callback throw.
    await expect(transaction.mock.results[0].value).rejects.toBeDefined();
  });

  it('wraps an unexpected throw into a domain error', async () => {
    const { unitOfWork } = setup();

    const result = await unitOfWork.run(() => {
      throw new Error('connection reset');
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNEXPECTED_ERROR');
    expect(result.error.message).toBe('La operación no pudo completarse.');
  });

  it('does not leak the driver message to the caller', async () => {
    const { unitOfWork } = setup();

    const result = await unitOfWork.run(() =>
      Promise.reject(new Error('password authentication failed for user "admin"')),
    );

    expect(JSON.stringify(result.ok ? {} : { message: result.error.message })).not.toContain(
      'password',
    );
  });
});
