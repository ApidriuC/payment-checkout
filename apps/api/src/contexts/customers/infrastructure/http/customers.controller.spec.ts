import { FindOrCreateCustomerUseCase } from '@/contexts/customers/application/find-or-create-customer.use-case';
import { GetCustomerUseCase } from '@/contexts/customers/application/get-customer.use-case';
import {
  InMemoryCustomerRepository,
  SequentialIdGenerator,
} from '@test/fakes/in-memory-repositories';

import { CustomersController } from './customers.controller';

const setup = async (options: { withLegalId?: boolean } = {}) => {
  const customers = new InMemoryCustomerRepository();
  const findOrCreate = new FindOrCreateCustomerUseCase(
    customers,
    new SequentialIdGenerator('customer'),
  );

  await findOrCreate.execute({
    email: 'ana.perez@example.com',
    fullName: 'Ana Pérez',
    phoneNumber: '+573001112233',
    legalIdType: options.withLegalId === false ? null : 'CC',
    legalIdNumber: options.withLegalId === false ? null : '1020304050',
  });

  return { controller: new CustomersController(new GetCustomerUseCase(customers)) };
};

describe('CustomersController', () => {
  it('returns the stored customer', async () => {
    const { controller } = await setup();

    const response = await controller.findOne('customer-1');

    expect(response).toEqual({
      id: 'customer-1',
      email: 'ana.perez@example.com',
      fullName: 'Ana Pérez',
      phoneNumber: '+573001112233',
      legalIdType: 'CC',
      legalId: '1020304050',
    });
  });

  it('returns nulls when the customer has no legal id', async () => {
    const { controller } = await setup({ withLegalId: false });

    const response = await controller.findOne('customer-1');

    expect(response.legalIdType).toBeNull();
    expect(response.legalId).toBeNull();
  });

  it('answers 404 for an unknown customer', async () => {
    const { controller } = await setup();

    await expect(controller.findOne('missing')).rejects.toMatchObject({ status: 404 });
  });
});
