import {
  detectBrand,
  formatCardNumber,
  formatExpiry,
  isCardValid,
  isExpired,
  lastFourOf,
  maskCardNumber,
  onlyDigits,
  parseExpiry,
  passesLuhn,
  validateCard,
  type CardInput,
} from './card';

const TODAY = new Date('2026-07-24T12:00:00.000Z');

const VISA = '4242424242424242';
const MASTERCARD = '5555555555554444';

const card = (overrides: Partial<CardInput> = {}): CardInput => ({
  number: VISA,
  holder: 'ANA PEREZ',
  expiry: '1229',
  cvc: '123',
  ...overrides,
});

describe('onlyDigits', () => {
  it('strips every non-digit character', () => {
    expect(onlyDigits('4242 4242-4242_4242')).toBe(VISA);
  });
});

describe('detectBrand', () => {
  it.each([
    ['4111111111111111', 'VISA'],
    [VISA, 'VISA'],
    [MASTERCARD, 'MASTERCARD'],
    ['5105105105105100', 'MASTERCARD'],
    ['2221000000000009', 'MASTERCARD'],
    ['2720999999999996', 'MASTERCARD'],
  ])('detects %s as %s', (number, brand) => {
    expect(detectBrand(number)).toBe(brand);
  });

  it.each([
    ['378282246310005', 'American Express'],
    ['6011111111111117', 'Discover'],
    ['', 'empty'],
  ])('returns UNKNOWN for %s (%s)', (number) => {
    expect(detectBrand(number)).toBe('UNKNOWN');
  });

  it('detects the brand while the number is still being typed', () => {
    expect(detectBrand('42')).toBe('VISA');
    expect(detectBrand('55')).toBe('MASTERCARD');
  });
});

describe('formatCardNumber', () => {
  it('groups the digits in blocks of four', () => {
    expect(formatCardNumber(VISA)).toBe('4242 4242 4242 4242');
  });

  it('formats a partial number without a trailing space', () => {
    expect(formatCardNumber('424242')).toBe('4242 42');
  });

  it('caps the length at 19 digits', () => {
    expect(onlyDigits(formatCardNumber('1'.repeat(30)))).toHaveLength(19);
  });
});

describe('formatExpiry', () => {
  it.each([
    ['1', '1'],
    ['12', '12'],
    ['122', '12/2'],
    ['1229', '12/29'],
    ['122999', '12/29'],
  ])('formats %p as %p', (input, expected) => {
    expect(formatExpiry(input)).toBe(expected);
  });
});

describe('maskCardNumber', () => {
  it('shows only the last four digits', () => {
    expect(maskCardNumber(VISA)).toBe('•••• 4242');
  });

  it('returns an empty string for a number that is too short', () => {
    expect(maskCardNumber('42')).toBe('');
  });
});

describe('lastFourOf', () => {
  it('extracts the last four digits', () => {
    expect(lastFourOf('4242 4242 4242 1881')).toBe('1881');
  });
});

describe('passesLuhn', () => {
  it.each([VISA, MASTERCARD, '4111111111111111', '5105105105105100'])(
    'accepts the valid number %s',
    (number) => {
      expect(passesLuhn(number)).toBe(true);
    },
  );

  it('rejects a number with a single mistyped digit', () => {
    expect(passesLuhn('4242424242424243')).toBe(false);
  });

  it('rejects a number that is too short', () => {
    expect(passesLuhn('4242')).toBe(false);
  });
});

describe('parseExpiry', () => {
  it('splits month and year', () => {
    expect(parseExpiry('1229')).toEqual({ month: 12, year: 2029 });
  });

  it('rejects an incomplete date', () => {
    expect(parseExpiry('12')).toBeNull();
  });

  it.each(['0029', '1329'])('rejects the invalid month in %p', (value) => {
    expect(parseExpiry(value)).toBeNull();
  });
});

describe('isExpired', () => {
  it('accepts a future date', () => {
    expect(isExpired('1229', TODAY)).toBe(false);
  });

  it('accepts a card that expires this very month', () => {
    expect(isExpired('0726', TODAY)).toBe(false);
  });

  it('rejects the month right before today', () => {
    expect(isExpired('0626', TODAY)).toBe(true);
  });

  it('rejects a past year', () => {
    expect(isExpired('1225', TODAY)).toBe(true);
  });

  it('treats an unparseable date as expired', () => {
    expect(isExpired('99', TODAY)).toBe(true);
  });
});

describe('validateCard', () => {
  it('accepts a well formed Visa', () => {
    expect(validateCard(card(), TODAY)).toEqual({});
    expect(isCardValid(card(), TODAY)).toBe(true);
  });

  it('accepts a well formed Mastercard', () => {
    expect(isCardValid(card({ number: MASTERCARD }), TODAY)).toBe(true);
  });

  it('asks for a number when the field is empty', () => {
    expect(validateCard(card({ number: '' }), TODAY).number).toBe(
      'Ingresa el número de la tarjeta.',
    );
  });

  it('rejects a brand the store does not accept', () => {
    expect(validateCard(card({ number: '378282246310005' }), TODAY).number).toBe(
      'Solo aceptamos Visa y Mastercard.',
    );
  });

  it('rejects an incomplete number', () => {
    expect(validateCard(card({ number: '424242424242' }), TODAY).number).toBe(
      'El número de tarjeta está incompleto.',
    );
  });

  it('rejects a number that fails the checksum', () => {
    expect(validateCard(card({ number: '4242424242424243' }), TODAY).number).toBe(
      'El número de tarjeta no es válido.',
    );
  });

  it('rejects a holder name that is too short', () => {
    expect(validateCard(card({ holder: 'AB' }), TODAY).holder).toBeDefined();
  });

  it('rejects a malformed expiry', () => {
    expect(validateCard(card({ expiry: '13' }), TODAY).expiry).toBe('Usa el formato MM/AA.');
  });

  it('rejects an expired card', () => {
    expect(validateCard(card({ expiry: '0125' }), TODAY).expiry).toBe('La tarjeta está vencida.');
  });

  it('rejects a CVC of the wrong length', () => {
    expect(validateCard(card({ cvc: '12' }), TODAY).cvc).toBe(
      'El código de seguridad tiene 3 dígitos.',
    );
  });

  it('reports every problem at once', () => {
    const errors = validateCard({ number: '', holder: '', expiry: '', cvc: '' }, TODAY);

    expect(Object.keys(errors).sort()).toEqual(['cvc', 'expiry', 'holder', 'number']);
  });
});
