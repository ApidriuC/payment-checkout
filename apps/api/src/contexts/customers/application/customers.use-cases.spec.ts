import {
  InMemoryCustomerRepository,
  SequentialIdGenerator,
} from '@test/fakes/in-memory-repositories';

import { FindOrCreateCustomerUseCase } from './find-or-create-customer.use-case';
import { GetCustomerUseCase } from './get-customer.use-case';

const details = {
  email: 'ana.perez@example.com',
  fullName: 'Ana Pérez',
  phoneNumber: '+573001112233',
  legalIdType: 'CC',
  legalIdNumber: '1020304050',
};

const setup = () => {
  const customers = new InMemoryCustomerRepository();

  return {
    customers,
    findOrCreate: new FindOrCreateCustomerUseCase(customers, new SequentialIdGenerator('customer')),
    getCustomer: new GetCustomerUseCase(customers),
  };
};

describe('FindOrCreateCustomerUseCase', () => {
  it('creates a customer the first time', async () => {
    const { findOrCreate } = setup();

    const result = await findOrCreate.execute(details);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe('customer-1');
    expect(result.value.fullName.value).toBe('Ana Pérez');
  });

  it('reuses the existing customer on a second checkout', async () => {
    const { findOrCreate } = setup();

    const first = await findOrCreate.execute(details);
    const second = await findOrCreate.execute(details);

    expect(first.ok && second.ok && first.value.id === second.value.id).toBe(true);
  });

  it('matches an existing customer regardless of email casing', async () => {
    const { findOrCreate } = setup();

    const first = await findOrCreate.execute(details);
    const second = await findOrCreate.execute({ ...details, email: 'Ana.Perez@Example.COM' });

    expect(first.ok && second.ok && first.value.id === second.value.id).toBe(true);
  });

  it('refreshes the contact details of a returning customer', async () => {
    const { findOrCreate } = setup();

    await findOrCreate.execute(details);
    const second = await findOrCreate.execute({ ...details, phoneNumber: '+573009998877' });

    expect(second.ok && second.value.phoneNumber.value).toBe('+573009998877');
  });

  it('rejects an invalid email before touching the repository', async () => {
    const { findOrCreate } = setup();

    const result = await findOrCreate.execute({ ...details, email: 'roto' });

    expect(result.ok ? null : result.error.code).toBe('INVALID_EMAIL');
  });

  it('rejects an invalid phone number', async () => {
    const { findOrCreate } = setup();

    const result = await findOrCreate.execute({ ...details, phoneNumber: '12' });

    expect(result.ok ? null : result.error.code).toBe('INVALID_PHONE_NUMBER');
  });

  it('accepts a customer without a legal id', async () => {
    const { findOrCreate } = setup();

    const result = await findOrCreate.execute({
      email: details.email,
      fullName: details.fullName,
      phoneNumber: details.phoneNumber,
    });

    expect(result.ok && result.value.legalId).toBeNull();
  });
});

describe('GetCustomerUseCase', () => {
  it('returns a stored customer', async () => {
    const { findOrCreate, getCustomer } = setup();
    await findOrCreate.execute(details);

    const result = await getCustomer.execute('customer-1');

    expect(result.ok && result.value.email.value).toBe('ana.perez@example.com');
  });

  it('fails for an unknown customer', async () => {
    const { getCustomer } = setup();

    const result = await getCustomer.execute('missing');

    expect(result.ok ? null : result.error.code).toBe('CUSTOMER_NOT_FOUND');
  });
});
