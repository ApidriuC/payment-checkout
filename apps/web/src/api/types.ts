export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  priceInCents: number;
  currency: string;
  imageUrl: string;
  availableUnits: number;
}

export interface StockSummary {
  productId: string;
  availableUnits: number;
  reservedUnits: number;
}

export type TransactionStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';

export interface TransactionAmounts {
  productAmountInCents: number;
  baseFeeInCents: number;
  deliveryFeeInCents: number;
  totalInCents: number;
  currency: string;
}

export interface Transaction {
  reference: string;
  status: TransactionStatus;
  productId: string;
  customerId: string;
  quantity: number;
  amounts: TransactionAmounts;
  cardBrand: string | null;
  cardLastFour: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CheckoutConfig {
  publicKey: string;
  tokenizationUrl: string;
  acceptanceToken: string;
  personalDataAuthToken: string | null;
  termsUrl: string | null;
  baseFeeInCents: number;
  deliveryFeeInCents: number;
}

export interface CreateTransactionPayload {
  productId: string;
  quantity: number;
  customer: {
    email: string;
    fullName: string;
    phoneNumber: string;
    legalIdType?: string;
    legalIdNumber?: string;
  };
  delivery: {
    recipientName: string;
    recipientPhone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    region: string;
    country?: string;
    postalCode?: string;
  };
}

export interface ProcessPaymentPayload {
  cardToken: string;
  acceptanceToken: string;
  personalDataAuthToken?: string;
  installments: number;
  cardBrand: string;
  cardLastFour: string;
}

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}
