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
  installments: number;
}

export interface ChargeResult {
  gatewayTransactionId: string;
  gatewayStatus: string;
  failureReason?: string | null;
}

export interface PaymentGateway {
  charge(request: ChargeRequest): AsyncResult<ChargeResult, DomainError>;

  findByReference(reference: string): AsyncResult<ChargeResult | null, DomainError>;

  verifyEventSignature(payload: Record<string, unknown>, signature: string, timestamp: string): boolean;
}
