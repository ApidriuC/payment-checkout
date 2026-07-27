import axios, { AxiosError } from 'axios';

import type { CardInput } from '@/domain/card';

import type { CheckoutConfig } from './types';
import { tokenizeCard } from './tokenize-card';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const card: CardInput = {
  number: '4242 4242 4242 4242',
  holder: '  ANA PEREZ  ',
  expiry: '1229',
  cvc: '123',
};

const config: CheckoutConfig = {
  publicKey: 'pub_test',
  tokenizationUrl: 'https://gateway.test/v1/tokens/cards',
  acceptanceToken: 'acc_test',
  personalDataAuthToken: null,
  termsUrl: null,
  baseFeeInCents: 500000,
  deliveryFeeInCents: 1000000,
};

beforeEach(() => {
  mockedAxios.isAxiosError.mockImplementation(
    (payload: unknown): payload is AxiosError => payload instanceof AxiosError,
  );
});

describe('tokenizeCard', () => {
  it('sends the card straight to the gateway with the public key', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { status: 'CREATED', data: { id: 'tok_1', brand: 'VISA', last_four: '4242' } },
    });

    await tokenizeCard(card, config);

    const [url, body, options] = mockedAxios.post.mock.calls[0] as [
      string,
      Record<string, string>,
      { headers: Record<string, string> },
    ];

    expect(url).toBe('https://gateway.test/v1/tokens/cards');
    expect(options.headers.Authorization).toBe('Bearer pub_test');
    expect(body).toEqual({
      number: '4242424242424242',
      cvc: '123',
      exp_month: '12',
      exp_year: '29',
      card_holder: 'ANA PEREZ',
    });
  });

  it('returns the token with the brand normalized', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { status: 'CREATED', data: { id: 'tok_1', brand: 'visa', last_four: '4242' } },
    });

    await expect(tokenizeCard(card, config)).resolves.toEqual({
      token: 'tok_1',
      brand: 'VISA',
      lastFour: '4242',
    });
  });

  it('pads a single digit month', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { status: 'CREATED', data: { id: 'tok_1', brand: 'VISA', last_four: '4242' } },
    });

    await tokenizeCard({ ...card, expiry: '0330' }, config);

    const body = mockedAxios.post.mock.calls[0][1] as Record<string, string>;
    expect(body.exp_month).toBe('03');
    expect(body.exp_year).toBe('30');
  });

  it('refuses to call the gateway with an unparseable expiry', async () => {
    await expect(tokenizeCard({ ...card, expiry: '99' }, config)).rejects.toThrow(
      'La fecha de expiración no es válida.',
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('surfaces the validation message the gateway returned', async () => {
    const failure = new AxiosError('rejected');
    failure.response = {
      status: 422,
      data: {
        error: {
          type: 'INPUT_VALIDATION_ERROR',
          messages: {
            number: ['El número de tarjeta usado no es aceptado en el ambiente de pruebas.'],
          },
        },
      },
      statusText: '',
      headers: {},
      config: { headers: {} },
    } as never;
    mockedAxios.post.mockRejectedValue(failure);

    await expect(tokenizeCard(card, config)).rejects.toMatchObject({
      code: 'INPUT_VALIDATION_ERROR',
      message: 'El número de tarjeta usado no es aceptado en el ambiente de pruebas.',
      statusCode: 422,
    });
  });

  it('falls back to the reason when the gateway sends no field messages', async () => {
    const failure = new AxiosError('rejected');
    failure.response = {
      status: 422,
      data: { error: { type: 'CARD_ERROR', reason: 'La tarjeta está vencida.' } },
      statusText: '',
      headers: {},
      config: { headers: {} },
    } as never;
    mockedAxios.post.mockRejectedValue(failure);

    await expect(tokenizeCard(card, config)).rejects.toMatchObject({
      message: 'La tarjeta está vencida.',
    });
  });

  it('reports a network failure without inventing a card reason', async () => {
    mockedAxios.post.mockRejectedValue(new AxiosError('Network Error'));

    await expect(tokenizeCard(card, config)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('maps a gateway rejection into an ApiError', async () => {
    const failure = new AxiosError('rejected');
    failure.response = {
      status: 422,
      data: { statusCode: 422, code: 'INVALID_CARD', message: 'La tarjeta fue rechazada.' },
      statusText: '',
      headers: {},
      config: { headers: {} },
    } as never;
    mockedAxios.post.mockRejectedValue(failure);

    await expect(tokenizeCard(card, config)).rejects.toMatchObject({
      code: 'INVALID_CARD',
      message: 'La tarjeta fue rechazada.',
    });
  });

  it('falls back to UNKNOWN when the gateway omits the brand', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { status: 'CREATED', data: { id: 'tok_1', brand: undefined, last_four: '4242' } },
    });

    await expect(tokenizeCard(card, config)).resolves.toMatchObject({ brand: 'UNKNOWN' });
  });
});
