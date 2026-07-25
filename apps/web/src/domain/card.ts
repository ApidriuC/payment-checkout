export type CardBrand = 'VISA' | 'MASTERCARD' | 'UNKNOWN';

export interface CardInput {
  number: string;
  holder: string;
  expiry: string;
  cvc: string;
}

export type CardField = keyof CardInput;

export type CardErrors = Partial<Record<CardField, string>>;

const BRAND_RULES: { brand: CardBrand; pattern: RegExp; lengths: number[]; cvcLength: number }[] = [
  { brand: 'VISA', pattern: /^4/, lengths: [13, 16, 19], cvcLength: 3 },
  {
    brand: 'MASTERCARD',
    pattern: /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/,
    lengths: [16],
    cvcLength: 3,
  },
];

export const onlyDigits = (value: string): string => value.replace(/\D/g, '');

export const detectBrand = (cardNumber: string): CardBrand =>
  BRAND_RULES.find((rule) => rule.pattern.test(onlyDigits(cardNumber)))?.brand ?? 'UNKNOWN';

export const formatCardNumber = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
};

export const formatExpiry = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

export const maskCardNumber = (cardNumber: string): string => {
  const digits = onlyDigits(cardNumber);
  return digits.length < 4 ? '' : `•••• ${digits.slice(-4)}`;
};

export const lastFourOf = (cardNumber: string): string => onlyDigits(cardNumber).slice(-4);

/** Luhn checksum: catches the typos a length check alone would let through. */
export const passesLuhn = (cardNumber: string): boolean => {
  const digits = onlyDigits(cardNumber);
  if (digits.length < 12) return false;

  let sum = 0;
  let double = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);

    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    double = !double;
  }

  return sum % 10 === 0;
};

export const parseExpiry = (expiry: string): { month: number; year: number } | null => {
  const digits = onlyDigits(expiry);
  if (digits.length !== 4) return null;

  const month = Number(digits.slice(0, 2));
  const year = 2000 + Number(digits.slice(2));

  if (month < 1 || month > 12) return null;

  return { month, year };
};

export const isExpired = (expiry: string, today = new Date()): boolean => {
  const parsed = parseExpiry(expiry);
  if (!parsed) return true;

  // A card stays valid through the last day of its expiry month.
  const endOfMonth = new Date(parsed.year, parsed.month, 1);

  return endOfMonth <= today;
};

export const validateCard = (card: CardInput, today = new Date()): CardErrors => {
  const errors: CardErrors = {};
  const digits = onlyDigits(card.number);
  const brand = detectBrand(card.number);
  const rule = BRAND_RULES.find((candidate) => candidate.brand === brand);

  if (!digits) {
    errors.number = 'Ingresa el número de la tarjeta.';
  } else if (brand === 'UNKNOWN') {
    errors.number = 'Solo aceptamos Visa y Mastercard.';
  } else if (!rule?.lengths.includes(digits.length)) {
    errors.number = 'El número de tarjeta está incompleto.';
  } else if (!passesLuhn(digits)) {
    errors.number = 'El número de tarjeta no es válido.';
  }

  if (card.holder.trim().length < 3) {
    errors.holder = 'Ingresa el nombre como aparece en la tarjeta.';
  }

  if (!parseExpiry(card.expiry)) {
    errors.expiry = 'Usa el formato MM/AA.';
  } else if (isExpired(card.expiry, today)) {
    errors.expiry = 'La tarjeta está vencida.';
  }

  const cvcLength = rule?.cvcLength ?? 3;
  if (onlyDigits(card.cvc).length !== cvcLength) {
    errors.cvc = `El código de seguridad tiene ${cvcLength} dígitos.`;
  }

  return errors;
};

export const isCardValid = (card: CardInput, today = new Date()): boolean =>
  Object.keys(validateCard(card, today)).length === 0;
