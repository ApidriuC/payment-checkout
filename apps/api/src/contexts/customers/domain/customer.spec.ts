import { Customer, type CustomerInput } from './customer';
import { LegalIdType } from './value-objects';

const input = (overrides: Partial<CustomerInput> = {}): CustomerInput => ({
  id: 'd1e2f3a4-b5c6-4d7e-8f90-1a2b3c4d5e6f',
  email: 'ana.perez@example.com',
  fullName: 'Ana Pérez',
  phoneNumber: '+573001112233',
  legalIdType: 'CC',
  legalIdNumber: '1020304050',
  ...overrides,
});

describe('Customer', () => {
  describe('create', () => {
    it('builds a customer with every value object validated', () => {
      const result = Customer.create(input());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.email.value).toBe('ana.perez@example.com');
        expect(result.value.legalId?.type).toBe(LegalIdType.CC);
      }
    });

    it('allows omitting the legal id', () => {
      const result = Customer.create(input({ legalIdType: null, legalIdNumber: null }));

      expect(result.ok && result.value.legalId).toBeNull();
    });

    it('treats a partial legal id as absent', () => {
      const result = Customer.create(input({ legalIdNumber: null }));

      expect(result.ok && result.value.legalId).toBeNull();
    });

    it('fails on an invalid email', () => {
      expect(Customer.create(input({ email: 'no-es-correo' })).ok).toBe(false);
    });

    it('fails on an invalid name', () => {
      expect(Customer.create(input({ fullName: 'A' })).ok).toBe(false);
    });

    it('fails on an invalid phone number', () => {
      expect(Customer.create(input({ phoneNumber: '12' })).ok).toBe(false);
    });

    it('fails on an invalid legal id', () => {
      expect(Customer.create(input({ legalIdType: 'DNI' })).ok).toBe(false);
    });
  });

  describe('withUpdatedDetails', () => {
    it('refreshes the contact details keeping the same id', () => {
      const original = Customer.create(input());
      if (!original.ok) throw new Error('fixture');

      const updated = original.value.withUpdatedDetails({
        email: 'ana.perez@example.com',
        fullName: 'Ana María Pérez',
        phoneNumber: '+573009998877',
        legalIdType: 'CC',
        legalIdNumber: '1020304050',
      });

      expect(updated.ok).toBe(true);
      if (updated.ok) {
        expect(updated.value.id).toBe(original.value.id);
        expect(updated.value.fullName.value).toBe('Ana María Pérez');
        expect(updated.value.phoneNumber.value).toBe('+573009998877');
      }
    });

    it('fails when the new details are invalid', () => {
      const original = Customer.create(input());
      if (!original.ok) throw new Error('fixture');

      const updated = original.value.withUpdatedDetails({
        email: 'roto',
        fullName: 'Ana Pérez',
        phoneNumber: '+573001112233',
      });

      expect(updated.ok).toBe(false);
    });
  });
});
