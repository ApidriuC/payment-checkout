import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult } from '@/shared/domain/result';

export const PAYMENT_GATEWAY = Symbol('PaymentGateway');

export interface ChargeRequest {
  reference: string;
  amountInCents: number;
  currency: string;
  customerEmail: string;
  /** Single-use token produced by the client; the raw card never reaches this service. */
  cardToken: string;
  acceptanceToken: string;
  personalDataAuthToken?: string | null;
  installments: number;
}

export interface ChargeResult {
  gatewayTransactionId: string;
  gatewayStatus: string;
  failureReason?: string | null;
}

export interface CheckoutConfig {
  publicKey: string;
  tokenizationUrl: string;
  acceptanceToken: string;
  personalDataAuthToken: string | null;
  termsUrl: string | null;
}

export interface GatewayEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
  signature: {
    properties: string[];
    checksum: string;
  };
}

export interface PaymentGateway {
  /** Public data the SPA needs to tokenize a card without hardcoding gateway details. */
  getCheckoutConfig(): AsyncResult<CheckoutConfig, DomainError>;

  charge(request: ChargeRequest): AsyncResult<ChargeResult, DomainError>;

  findCharge(gatewayTransactionId: string): AsyncResult<ChargeResult, DomainError>;

  verifyEventSignature(event: GatewayEvent): boolean;
}
