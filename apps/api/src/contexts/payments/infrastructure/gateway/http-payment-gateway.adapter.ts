import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance, isAxiosError } from 'axios';

import {
  PaymentGatewayRejectedError,
  PaymentGatewayUnavailableError,
} from '@/contexts/payments/domain/errors';
import {
  type ChargeRequest,
  type ChargeResult,
  type CheckoutConfig,
  type GatewayEvent,
  type PaymentGateway,
} from '@/contexts/payments/domain/ports/payment-gateway.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult, err, ok } from '@/shared/domain/result';
import { type PaymentGatewayConfig } from '@/shared/infrastructure/config/configuration';

import { buildEventChecksum, buildIntegritySignature, checksumMatches } from './signature';

interface MerchantResponse {
  data: {
    presigned_acceptance?: { acceptance_token: string; permalink?: string };
    presigned_personal_data_auth?: { acceptance_token: string };
  };
}

interface TransactionResponse {
  data: {
    id: string;
    status: string;
    status_message?: string | null;
  };
}

@Injectable()
export class HttpPaymentGateway implements PaymentGateway {
  private readonly logger = new Logger(HttpPaymentGateway.name);
  private readonly config: PaymentGatewayConfig;
  private readonly http: AxiosInstance;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<PaymentGatewayConfig>('paymentGateway');
    this.http = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeoutMs,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getCheckoutConfig(): AsyncResult<CheckoutConfig, DomainError> {
    try {
      const { data } = await this.http.get<MerchantResponse>(
        `/merchants/${this.config.publicKey}`,
      );

      const acceptance = data.data.presigned_acceptance;

      if (!acceptance?.acceptance_token) {
        return err(
          new PaymentGatewayUnavailableError('La pasarela no devolvió un token de aceptación.'),
        );
      }

      return ok({
        publicKey: this.config.publicKey,
        tokenizationUrl: `${this.config.baseUrl}/tokens/cards`,
        acceptanceToken: acceptance.acceptance_token,
        personalDataAuthToken: data.data.presigned_personal_data_auth?.acceptance_token ?? null,
        termsUrl: acceptance.permalink ?? null,
      });
    } catch (cause) {
      return this.toDomainError(cause, 'obtener la configuración de checkout');
    }
  }

  async charge(request: ChargeRequest): AsyncResult<ChargeResult, DomainError> {
    const signature = buildIntegritySignature({
      reference: request.reference,
      amountInCents: request.amountInCents,
      currency: request.currency,
      integrityKey: this.config.integrityKey,
    });

    try {
      const { data } = await this.http.post<TransactionResponse>(
        '/transactions',
        {
          acceptance_token: request.acceptanceToken,
          ...(request.personalDataAuthToken
            ? { accept_personal_auth: request.personalDataAuthToken }
            : {}),
          amount_in_cents: request.amountInCents,
          currency: request.currency,
          customer_email: request.customerEmail,
          reference: request.reference,
          signature,
          payment_method: {
            type: 'CARD',
            token: request.cardToken,
            installments: request.installments,
          },
        },
        { headers: { Authorization: `Bearer ${this.config.privateKey}` } },
      );

      return ok(this.toChargeResult(data));
    } catch (cause) {
      return this.toDomainError(cause, 'crear el pago');
    }
  }

  async findCharge(gatewayTransactionId: string): AsyncResult<ChargeResult, DomainError> {
    try {
      const { data } = await this.http.get<TransactionResponse>(
        `/transactions/${gatewayTransactionId}`,
        { headers: { Authorization: `Bearer ${this.config.privateKey}` } },
      );

      return ok(this.toChargeResult(data));
    } catch (cause) {
      return this.toDomainError(cause, 'consultar el pago');
    }
  }

  verifyEventSignature(event: GatewayEvent): boolean {
    const expected = buildEventChecksum({
      data: event.data,
      properties: event.signature.properties,
      timestamp: event.timestamp,
      eventsKey: this.config.eventsKey,
    });

    return checksumMatches(expected, event.signature.checksum);
  }

  private toChargeResult(response: TransactionResponse): ChargeResult {
    return {
      gatewayTransactionId: response.data.id,
      gatewayStatus: response.data.status,
      failureReason: response.data.status_message ?? null,
    };
  }

  private toDomainError(cause: unknown, action: string): { ok: false; error: DomainError } {
    if (isAxiosError(cause)) {
      const status = cause.response?.status;

      // 4xx means the request itself was wrong; retrying it unchanged will not help.
      if (status && status >= 400 && status < 500) {
        this.logger.warn(`La pasarela rechazó la solicitud al ${action} (HTTP ${status}).`);
        return err(new PaymentGatewayRejectedError(this.describeAxiosFailure(cause)));
      }

      this.logger.error(`Fallo al ${action}: ${cause.message}`);
      return err(new PaymentGatewayUnavailableError(cause.code ?? cause.message));
    }

    this.logger.error(`Fallo inesperado al ${action}.`, cause);
    return err(new PaymentGatewayUnavailableError('Error inesperado de la pasarela.'));
  }

  private describeAxiosFailure(cause: unknown): string {
    if (!isAxiosError(cause)) {
      return 'Solicitud inválida.';
    }

    const body = cause.response?.data as { error?: { reason?: string; type?: string } } | undefined;

    return body?.error?.reason ?? body?.error?.type ?? `HTTP ${cause.response?.status ?? 400}`;
  }
}
