import type * as AxiosModule from 'axios';
import { AxiosError } from 'axios';

import { api, ApiError, toApiError } from './client';

const mockHttp = { get: jest.fn(), post: jest.fn() };

jest.mock('axios', () => {
  const actual = jest.requireActual<typeof AxiosModule>('axios');

  return {
    __esModule: true,
    ...actual,
    default: {
      ...actual.default,
      // The factory runs before mockHttp is initialized, so the delegation is deferred.
      create: () => ({
        get: (...args: unknown[]) => mockHttp.get(...args),
        post: (...args: unknown[]) => mockHttp.post(...args),
      }),
    },
    isAxiosError: (payload: unknown) => payload instanceof actual.AxiosError,
  };
});

const axiosFailure = (status: number, data?: unknown): AxiosError => {
  const error = new AxiosError('failed');
  error.response = { status, data, statusText: '', headers: {}, config: { headers: {} } } as never;
  return error;
};

describe('toApiError', () => {
  it('keeps the code and message the API returned', () => {
    const error = toApiError(
      axiosFailure(409, {
        statusCode: 409,
        code: 'INSUFFICIENT_STOCK',
        message: 'No hay unidades suficientes.',
      }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('INSUFFICIENT_STOCK');
    expect(error.message).toBe('No hay unidades suficientes.');
    expect(error.statusCode).toBe(409);
  });

  it('reports a timeout in plain language', () => {
    const timeout = new AxiosError('timeout');
    timeout.code = 'ECONNABORTED';

    const error = toApiError(timeout);

    expect(error.code).toBe('TIMEOUT');
    expect(error.message).toBe('La solicitud tardó demasiado. Intenta de nuevo.');
  });

  it('reports an unreachable server', () => {
    const error = toApiError(new AxiosError('Network Error'));

    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toBe('No pudimos conectarnos con el servidor.');
  });

  it('reports a response without a recognizable body', () => {
    expect(toApiError(axiosFailure(500, '<html>oops</html>')).code).toBe('NETWORK_ERROR');
  });

  it('falls back for a non-axios failure', () => {
    const error = toApiError(new Error('boom'));

    expect(error.code).toBe('UNKNOWN');
    expect(error.message).toBe('Ocurrió un error inesperado.');
  });
});

describe('api', () => {
  it('lists products', async () => {
    mockHttp.get.mockResolvedValue({ data: [{ id: 'product-1' }] });

    await expect(api.listProducts()).resolves.toEqual([{ id: 'product-1' }]);
    expect(mockHttp.get).toHaveBeenCalledWith('/products');
  });

  it('reads one product', async () => {
    mockHttp.get.mockResolvedValue({ data: { id: 'product-1' } });

    await api.getProduct('product-1');

    expect(mockHttp.get).toHaveBeenCalledWith('/products/product-1');
  });

  it('reads the stock of a product', async () => {
    mockHttp.get.mockResolvedValue({ data: { productId: 'product-1' } });

    await api.getStock('product-1');

    expect(mockHttp.get).toHaveBeenCalledWith('/products/product-1/stock');
  });

  it('reads the checkout config', async () => {
    mockHttp.get.mockResolvedValue({ data: { publicKey: 'pub_test' } });

    await api.getCheckoutConfig();

    expect(mockHttp.get).toHaveBeenCalledWith('/checkout/config');
  });

  it('creates a transaction', async () => {
    mockHttp.post.mockResolvedValue({ data: { reference: 'TX-REF-1' } });
    const payload = { productId: 'product-1', quantity: 1 } as never;

    await api.createTransaction(payload);

    expect(mockHttp.post).toHaveBeenCalledWith('/transactions', payload);
  });

  it('pays a transaction by reference', async () => {
    mockHttp.post.mockResolvedValue({ data: { reference: 'TX-REF-1' } });
    const payload = { cardToken: 'tok_1' } as never;

    await api.payTransaction('TX-REF-1', payload);

    expect(mockHttp.post).toHaveBeenCalledWith('/transactions/TX-REF-1/payment', payload);
  });

  it('reads a transaction by reference', async () => {
    mockHttp.get.mockResolvedValue({ data: { reference: 'TX-REF-1' } });

    await api.getTransaction('TX-REF-1');

    expect(mockHttp.get).toHaveBeenCalledWith('/transactions/TX-REF-1');
  });

  it('propagates the failure so the caller can map it', async () => {
    mockHttp.get.mockRejectedValue(axiosFailure(404));

    await expect(api.getProduct('missing')).rejects.toBeDefined();
  });
});
