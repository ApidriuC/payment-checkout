import {
  InvalidCustomerNameError,
  InvalidEmailError,
  InvalidLegalIdError,
  InvalidPhoneNumberError,
} from './errors';
import { CustomerName, Email, LegalId, LegalIdType, PhoneNumber } from './value-objects';

describe('Email', () => {
  it('normalizes case and surrounding spaces', () => {
    const result = Email.create('  Ana.Perez@Example.COM ');

    expect(result.ok && result.value.value).toBe('ana.perez@example.com');
  });

  it.each(['sin-arroba', 'ana@', '@example.com', 'ana@example', 'ana perez@example.com', ''])(
    'rejects %p',
    (invalid) => {
      const result = Email.create(invalid);

      expect(result.ok).toBe(false);
      expect(result.ok ? null : result.error).toBeInstanceOf(InvalidEmailError);
    },
  );

  it('rejects an address longer than 255 characters', () => {
    const result = Email.create(`${'a'.repeat(250)}@example.com`);

    expect(result.ok).toBe(false);
  });

  it('accepts a subdomain', () => {
    expect(Email.create('ana@mail.example.co').ok).toBe(true);
  });
});

describe('CustomerName', () => {
  it('collapses repeated whitespace', () => {
    const result = CustomerName.create('  Ana   María   Pérez  ');

    expect(result.ok && result.value.value).toBe('Ana María Pérez');
  });

  it('rejects a name that is too short', () => {
    const result = CustomerName.create('An');

    expect(result.ok ? null : result.error).toBeInstanceOf(InvalidCustomerNameError);
  });

  it('rejects a name longer than 160 characters', () => {
    expect(CustomerName.create('a'.repeat(161)).ok).toBe(false);
  });
});

describe('PhoneNumber', () => {
  it('strips separators', () => {
    const result = PhoneNumber.create('(300) 111-2233');

    expect(result.ok && result.value.value).toBe('3001112233');
  });

  it('keeps the international prefix', () => {
    const result = PhoneNumber.create('+57 300 111 2233');

    expect(result.ok && result.value.value).toBe('+573001112233');
  });

  it.each(['123', 'abcdefgh', '', '+'])('rejects %p', (invalid) => {
    const result = PhoneNumber.create(invalid);

    expect(result.ok ? null : result.error).toBeInstanceOf(InvalidPhoneNumberError);
  });

  it('rejects a number longer than 15 digits', () => {
    expect(PhoneNumber.create('1'.repeat(16)).ok).toBe(false);
  });
});

describe('LegalId', () => {
  it('normalizes the type and strips dots', () => {
    const result = LegalId.create('cc', '1.020.304.050');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe(LegalIdType.CC);
      expect(result.value.number).toBe('1020304050');
    }
  });

  it.each(['CC', 'CE', 'NIT', 'PP'])('accepts the %s document type', (type) => {
    expect(LegalId.create(type, '1020304050').ok).toBe(true);
  });

  it('rejects an unknown document type', () => {
    const result = LegalId.create('DNI', '1020304050');

    expect(result.ok ? null : result.error).toBeInstanceOf(InvalidLegalIdError);
  });

  it('rejects a number that is too short', () => {
    expect(LegalId.create('CC', '123').ok).toBe(false);
  });

  it('rejects a number with invalid characters', () => {
    expect(LegalId.create('CC', '10203/4050').ok).toBe(false);
  });
});
