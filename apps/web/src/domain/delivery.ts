export interface DeliveryInput {
  fullName: string;
  email: string;
  phoneNumber: string;
  legalIdType: string;
  legalIdNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
}

export type DeliveryField = keyof DeliveryInput;

export type DeliveryErrors = Partial<Record<DeliveryField, string>>;

export const EMPTY_DELIVERY: DeliveryInput = {
  fullName: '',
  email: '',
  phoneNumber: '',
  legalIdType: 'CC',
  legalIdNumber: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: '',
  postalCode: '',
};

export const LEGAL_ID_TYPES = ['CC', 'CE', 'NIT', 'PP'] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const PHONE_PATTERN = /^\+?\d{7,15}$/;

export const validateDelivery = (input: DeliveryInput): DeliveryErrors => {
  const errors: DeliveryErrors = {};

  if (input.fullName.trim().length < 3) {
    errors.fullName = 'Ingresa tu nombre completo.';
  }

  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'Ingresa un correo electrónico válido.';
  }

  if (!PHONE_PATTERN.test(input.phoneNumber.replace(/[\s()-]/g, ''))) {
    errors.phoneNumber = 'Ingresa un teléfono válido.';
  }

  if (!LEGAL_ID_TYPES.includes(input.legalIdType as (typeof LEGAL_ID_TYPES)[number])) {
    errors.legalIdType = 'Selecciona un tipo de documento.';
  }

  if (input.legalIdNumber.replace(/[\s.]/g, '').length < 5) {
    errors.legalIdNumber = 'Ingresa tu número de documento.';
  }

  if (input.addressLine1.trim().length < 5) {
    errors.addressLine1 = 'Ingresa la dirección de entrega.';
  }

  if (input.city.trim().length < 2) {
    errors.city = 'Ingresa la ciudad.';
  }

  if (input.region.trim().length < 2) {
    errors.region = 'Ingresa el departamento.';
  }

  return errors;
};

export const isDeliveryValid = (input: DeliveryInput): boolean =>
  Object.keys(validateDelivery(input)).length === 0;
