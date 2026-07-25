import { PaymentGatewayUnavailableError } from '@/contexts/payments/domain/errors';
import {
  type ChargeRequest,
  type ChargeResult,
  type CheckoutConfig,
  type GatewayEvent,
  type PaymentGateway,
} from '@/contexts/payments/domain/ports/payment-gateway.port';
import { type ReferenceGenerator } from '@/contexts/payments/domain/ports/reference-generator.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult, err, ok } from '@/shared/domain/result';

export class StaticReferenceGenerator implements ReferenceGenerator {
  private counter = 0;

  generate(): string {
    this.counter += 1;
    return `TX-REF-${this.counter}`;
  }
}

export class FakePaymentGateway implements PaymentGateway {
  chargeResult: ChargeResult = { gatewayTransactionId: 'gw-1', gatewayStatus: 'APPROVED' };
  chargeFails = false;
  findResult: ChargeResult = { gatewayTransactionId: 'gw-1', gatewayStatus: 'APPROVED' };
  findFails = false;
  signatureValid = true;

  readonly chargeRequests: ChargeRequest[] = [];
  readonly lookups: string[] = [];

  getCheckoutConfig(): AsyncResult<CheckoutConfig, DomainError> {
    return Promise.resolve(
      ok({
        publicKey: 'pub_test',
        tokenizationUrl: 'https://gateway.test/v1/tokens/cards',
        acceptanceToken: 'acc_test',
        personalDataAuthToken: null,
        termsUrl: null,
      }),
    );
  }

  charge(request: ChargeRequest): AsyncResult<ChargeResult, DomainError> {
    this.chargeRequests.push(request);

    if (this.chargeFails) {
      return Promise.resolve(err(new PaymentGatewayUnavailableError('ECONNRESET')));
    }

    return Promise.resolve(ok(this.chargeResult));
  }

  findCharge(gatewayTransactionId: string): AsyncResult<ChargeResult, DomainError> {
    this.lookups.push(gatewayTransactionId);

    if (this.findFails) {
      return Promise.resolve(err(new PaymentGatewayUnavailableError('ETIMEDOUT')));
    }

    return Promise.resolve(ok(this.findResult));
  }

  verifyEventSignature(_event: GatewayEvent): boolean {
    return this.signatureValid;
  }
}
