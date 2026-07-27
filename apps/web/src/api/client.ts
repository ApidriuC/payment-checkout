import axios, { isAxiosError } from 'axios';

import type {
  ApiErrorBody,
  CheckoutConfig,
  CreateTransactionPayload,
  ProcessPaymentPayload,
  Product,
  StockSummary,
  Transaction,
} from './types';

export const http = axios.create({
  baseURL: __API_BASE_URL__,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const toApiError = (cause: unknown): ApiError => {
  // Ya mapeado por una capa anterior: volver a mapearlo perdería el motivo real.
  if (cause instanceof ApiError) {
    return cause;
  }

  if (isAxiosError(cause)) {
    const body = cause.response?.data as ApiErrorBody | undefined;

    if (body?.code) {
      return new ApiError(body.code, body.message, body.statusCode);
    }

    if (cause.code === 'ECONNABORTED') {
      return new ApiError('TIMEOUT', 'La solicitud tardó demasiado. Intenta de nuevo.', 0);
    }

    return new ApiError('NETWORK_ERROR', 'No pudimos conectarnos con el servidor.', 0);
  }

  return new ApiError('UNKNOWN', 'Ocurrió un error inesperado.', 0);
};

export const api = {
  async listProducts(): Promise<Product[]> {
    const { data } = await http.get<Product[]>('/products');
    return data;
  },

  async getProduct(id: string): Promise<Product> {
    const { data } = await http.get<Product>(`/products/${id}`);
    return data;
  },

  async getStock(productId: string): Promise<StockSummary> {
    const { data } = await http.get<StockSummary>(`/products/${productId}/stock`);
    return data;
  },

  async getCheckoutConfig(): Promise<CheckoutConfig> {
    const { data } = await http.get<CheckoutConfig>('/checkout/config');
    return data;
  },

  async createTransaction(payload: CreateTransactionPayload): Promise<Transaction> {
    const { data } = await http.post<Transaction>('/transactions', payload);
    return data;
  },

  async payTransaction(reference: string, payload: ProcessPaymentPayload): Promise<Transaction> {
    const { data } = await http.post<Transaction>(`/transactions/${reference}/payment`, payload);
    return data;
  },

  async getTransaction(reference: string): Promise<Transaction> {
    const { data } = await http.get<Transaction>(`/transactions/${reference}`);
    return data;
  },
};
