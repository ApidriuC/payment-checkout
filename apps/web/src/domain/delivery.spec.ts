import {
  EMPTY_DELIVERY,
  isDeliveryValid,
  validateDelivery,
  type DeliveryInput,
} from './delivery';

const delivery = (overrides: Partial<DeliveryInput> = {}): DeliveryInput => ({
  fullName: 'Ana Pérez',
  email: 'ana.perez@example.com',
  phoneNumber: '+573001112233',
  legalIdType: 'CC',
  legalIdNumber: '1020304050',
  addressLine1: 'Calle 123 # 45-67',
  addressLine2: '',
  city: 'Medellín',
  region: 'Antioquia',
  postalCode: '',
  ...overrides,
});

describe('validateDelivery', () => {
  it('accepts a complete form', () => {
    expect(validateDelivery(delivery())).toEqual({});
    expect(isDeliveryValid(delivery())).toBe(true);
  });

  it('reports every required field on an empty form', () => {
    const errors = validateDelivery(EMPTY_DELIVERY);

    expect(Object.keys(errors).sort()).toEqual([
      'addressLine1',
      'city',
      'email',
      'fullName',
      'legalIdNumber',
      'phoneNumber',
      'region',
    ]);
  });

  it('rejects a name that is too short', () => {
    expect(validateDelivery(delivery({ fullName: 'An' })).fullName).toBeDefined();
  });

  it.each(['sin-arroba', 'ana@', 'ana@example', '@example.com'])(
    'rejects the email %p',
    (email) => {
      expect(validateDelivery(delivery({ email })).email).toBeDefined();
    },
  );

  it('accepts a phone with separators', () => {
    expect(validateDelivery(delivery({ phoneNumber: '(300) 111-2233' })).phoneNumber).toBeUndefined();
  });

  it('rejects a phone that is too short', () => {
    expect(validateDelivery(delivery({ phoneNumber: '123' })).phoneNumber).toBeDefined();
  });

  it('rejects an unknown document type', () => {
    expect(validateDelivery(delivery({ legalIdType: 'DNI' })).legalIdType).toBeDefined();
  });

  it('accepts a document number written with dots', () => {
    expect(
      validateDelivery(delivery({ legalIdNumber: '1.020.304.050' })).legalIdNumber,
    ).toBeUndefined();
  });

  it('rejects an address that is too short', () => {
    expect(validateDelivery(delivery({ addressLine1: 'Cl 1' })).addressLine1).toBeDefined();
  });

  it('does not require the optional fields', () => {
    expect(validateDelivery(delivery({ addressLine2: '', postalCode: '' }))).toEqual({});
  });
});
