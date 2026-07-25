import { type ConfigService } from '@nestjs/config';
import axios, { AxiosError, type AxiosInstance } from 'axios';

import { type PaymentGatewayConfig } from '@/shared/infrastructure/config/configuration';

import { HttpPaymentGateway } from './http-payment-gateway.adapter';
import { buildEventChecksum } from './signature';

jest.mock('axios');

const CONFIG: PaymentGatewayConfig = {
  baseUrl: 'https://gateway.test/v1',
  publicKey: 'pub_test',
  privateKey: 'prv_test',
  integrityKey: 'integrity_test',
  eventsKey: 'events_test',
  timeoutMs: 5000,
};

const mockedAxios = axios as jest.Mocked<typeof axios>;

const setup = () => {
  const http = { get: jest.fn(), post: jest.fn() } as unknown as jest.Mocked<AxiosInstance>;
  mockedAxios.create.mockReturnValue(http);

  const configService = { getOrThrow: () => CONFIG } as unknown as ConfigService;

  return { gateway: new HttpPaymentGateway(configService), http };
};

const axiosFailure = (status: number, data?: unknown): AxiosError => {
  const error = new AxiosError('request failed');
  error.response = { status, data, statusText: '', headers: {}, config: { headers: {} } } as never;
  return error;
};

beforeEach(() => {
  mockedAxios.isAxiosError.mockImplementation(
    (payload: unknown): payload is AxiosError => payload instanceof AxiosError,
  );
});

describe('HttpPaymentGateway', () => {
  describe('getCheckoutConfig', () => {
    it('returns the public data the SPA needs', async () => {
      const { gateway, http } = setup();
      http.get.mockResolvedValue({
        data: {
          data: {
            presigned_acceptance: { acceptance_token: 'acc_1', permalink: 'https://terms' },
            presigned_personal_data_auth: { acceptance_token: 'auth_1' },
          },
        },
      });

      const result = await gateway.getCheckoutConfig();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toEqual({
        publicKey: 'pub_test',
        tokenizationUrl: 'https://gateway.test/v1/tokens/cards',
        acceptanceToken: 'acc_1',
        personalDataAuthToken: 'auth_1',
        termsUrl: 'https://terms',
      });
    });

    it('never exposes the private key', async () => {
      const { gateway, http } = setup();
      http.get.mockResolvedValue({
        data: { data: { presigned_acceptance: { acceptance_token: 'acc_1' } } },
      });

      const result = await gateway.getCheckoutConfig();

      expect(JSON.stringify(result)).not.toContain('prv_test');
    });

    it('fails when the gateway omits the acceptance token', async () => {
      const { gateway, http } = setup();
      http.get.mockResolvedValue({ data: { data: {} } });

      const result = await gateway.getCheckoutConfig();

      expect(result.ok ? null : result.error.code).toBe('PAYMENT_GATEWAY_UNAVAILABLE');
    });

    it('maps a network failure to an unavailable error', async () => {
      const { gateway, http } = setup();
      http.get.mockRejectedValue(new AxiosError('ECONNRESET'));

      const result = await gateway.getCheckoutConfig();

      expect(result.ok ? null : result.error.code).toBe('PAYMENT_GATEWAY_UNAVAILABLE');
    });
  });

  describe('charge', () => {
    const request = {
      reference: 'TX-REF-1',
      amountInCents: 93480000,
      currency: 'COP',
      customerEmail: 'ana.perez@example.com',
      cardToken: 'tok_1',
      acceptanceToken: 'acc_1',
      installments: 1,
    };

    it('signs the payload with reference, amount, currency and the integrity key', async () => {
      const { gateway, http } = setup();
      http.post.mockResolvedValue({ data: { data: { id: 'gw-1', status: 'APPROVED' } } });

      await gateway.charge(request);

      const body = http.post.mock.calls[0][1] as { signature: string };
      expect(body.signature).toHaveLength(64);
      expect(body).toMatchObject({
        amount_in_cents: 93480000,
        currency: 'COP',
        reference: 'TX-REF-1',
        payment_method: { type: 'CARD', token: 'tok_1', installments: 1 },
      });
    });

    it('authenticates with the private key', async () => {
      const { gateway, http } = setup();
      http.post.mockResolvedValue({ data: { data: { id: 'gw-1', status: 'APPROVED' } } });

      await gateway.charge(request);

      const options = http.post.mock.calls[0][2] as { headers: Record<string, string> };
      expect(options.headers.Authorization).toBe('Bearer prv_test');
    });

    it('omits the personal data authorization when it was not provided', async () => {
      const { gateway, http } = setup();
      http.post.mockResolvedValue({ data: { data: { id: 'gw-1', status: 'APPROVED' } } });

      await gateway.charge(request);

      expect(http.post.mock.calls[0][1]).not.toHaveProperty('accept_personal_auth');
    });

    it('includes the personal data authorization when provided', async () => {
      const { gateway, http } = setup();
      http.post.mockResolvedValue({ data: { data: { id: 'gw-1', status: 'APPROVED' } } });

      await gateway.charge({ ...request, personalDataAuthToken: 'auth_1' });

      expect(http.post.mock.calls[0][1]).toMatchObject({ accept_personal_auth: 'auth_1' });
    });

    it('returns the gateway id, status and failure reason', async () => {
      const { gateway, http } = setup();
      http.post.mockResolvedValue({
        data: { data: { id: 'gw-1', status: 'DECLINED', status_message: 'Fondos insuficientes' } },
      });

      const result = await gateway.charge(request);

      expect(result.ok && result.value).toEqual({
        gatewayTransactionId: 'gw-1',
        gatewayStatus: 'DECLINED',
        failureReason: 'Fondos insuficientes',
      });
    });

    it('maps a 4xx to a rejection the caller should not retry', async () => {
      const { gateway, http } = setup();
      http.post.mockRejectedValue(
        axiosFailure(422, { error: { reason: 'La tarjeta expiró', type: 'INVALID_INPUT' } }),
      );

      const result = await gateway.charge(request);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('PAYMENT_GATEWAY_REJECTED');
      expect(result.error.details).toMatchObject({ detail: 'La tarjeta expiró' });
    });

    it('maps a 5xx to an unavailable gateway', async () => {
      const { gateway, http } = setup();
      http.post.mockRejectedValue(axiosFailure(503));

      const result = await gateway.charge(request);

      expect(result.ok ? null : result.error.code).toBe('PAYMENT_GATEWAY_UNAVAILABLE');
    });

    it('maps a non-axios failure to an unavailable gateway', async () => {
      const { gateway, http } = setup();
      http.post.mockRejectedValue(new Error('boom'));

      const result = await gateway.charge(request);

      expect(result.ok ? null : result.error.code).toBe('PAYMENT_GATEWAY_UNAVAILABLE');
    });
  });

  describe('findCharge', () => {
    it('reads the current status of a payment', async () => {
      const { gateway, http } = setup();
      http.get.mockResolvedValue({ data: { data: { id: 'gw-1', status: 'APPROVED' } } });

      const result = await gateway.findCharge('gw-1');

      expect(http.get.mock.calls[0][0]).toBe('/transactions/gw-1');
      expect(result.ok && result.value.gatewayStatus).toBe('APPROVED');
    });

    it('fails when the lookup breaks', async () => {
      const { gateway, http } = setup();
      http.get.mockRejectedValue(axiosFailure(500));

      const result = await gateway.findCharge('gw-1');

      expect(result.ok).toBe(false);
    });
  });

  describe('verifyEventSignature', () => {
    const data = { transaction: { id: 'gw-1', status: 'APPROVED' } };
    const properties = ['transaction.id', 'transaction.status'];
    const timestamp = 1784926800;

    it('accepts an event signed with the events key', () => {
      const { gateway } = setup();
      const checksum = buildEventChecksum({
        data,
        properties,
        timestamp,
        eventsKey: CONFIG.eventsKey,
      });

      const valid = gateway.verifyEventSignature({
        event: 'transaction.updated',
        data,
        timestamp,
        signature: { properties, checksum },
      });

      expect(valid).toBe(true);
    });

    it('rejects an event signed with another key', () => {
      const { gateway } = setup();
      const checksum = buildEventChecksum({ data, properties, timestamp, eventsKey: 'otra' });

      const valid = gateway.verifyEventSignature({
        event: 'transaction.updated',
        data,
        timestamp,
        signature: { properties, checksum },
      });

      expect(valid).toBe(false);
    });

    it('rejects an event whose payload was tampered with', () => {
      const { gateway } = setup();
      const checksum = buildEventChecksum({
        data,
        properties,
        timestamp,
        eventsKey: CONFIG.eventsKey,
      });

      const valid = gateway.verifyEventSignature({
        event: 'transaction.updated',
        data: { transaction: { id: 'gw-1', status: 'DECLINED' } },
        timestamp,
        signature: { properties, checksum },
      });

      expect(valid).toBe(false);
    });
  });
});
