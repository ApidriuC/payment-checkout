import { api } from '@/api/client';
import { tokenizeCard } from '@/api/tokenize-card';
import type { Transaction } from '@/api/types';
import type { CardInput } from '@/domain/card';
import { EMPTY_DELIVERY, type DeliveryInput } from '@/domain/delivery';
import { makeStore } from '@test/render';

import {
  initialPaymentState,
  paymentReducer,
  paymentReset,
  payNow,
  refreshTransaction,
  toCreatePayload,
} from './payment.slice';

jest.mock('@/api/client', () => ({
  api: {
    createTransaction: jest.fn(),
    getCheckoutConfig: jest.fn(),
    payTransaction: jest.fn(),
    getTransaction: jest.fn(),
  },
  toApiError: (cause: unknown) => ({
    message: cause instanceof Error ? cause.message : 'Ocurrió un error inesperado.',
  }),
}));

jest.mock('@/api/tokenize-card', () => ({ tokenizeCard: jest.fn() }));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedTokenize = tokenizeCard as jest.MockedFunction<typeof tokenizeCard>;

const delivery: DeliveryInput = {
  ...EMPTY_DELIVERY,
  fullName: '  Ana Pérez  ',
  email: '  ana.perez@example.com ',
  phoneNumber: ' +573001112233 ',
  legalIdType: 'CC',
  legalIdNumber: ' 1020304050 ',
  addressLine1: ' Calle 123 # 45-67 ',
  city: ' Medellín ',
  region: ' Antioquia ',
};

const card: CardInput = { number: '4242424242424242', holder: 'ANA PEREZ', expiry: '1229', cvc: '123' };

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  reference: 'TX-REF-1',
  status: 'APPROVED',
  productId: 'product-1',
  customerId: 'customer-1',
  quantity: 2,
  amounts: {
    productAmountInCents: 91980000,
    baseFeeInCents: 500000,
    deliveryFeeInCents: 1000000,
    totalInCents: 93480000,
    currency: 'COP',
  },
  cardBrand: 'VISA',
  cardLastFour: '4242',
  failureReason: null,
  createdAt: '2026-07-24T12:00:00.000Z',
  completedAt: '2026-07-24T12:00:05.000Z',
  ...overrides,
});

const config = {
  publicKey: 'pub_test',
  tokenizationUrl: 'https://gateway.test/v1/tokens/cards',
  acceptanceToken: 'acc_test',
  personalDataAuthToken: null,
  termsUrl: null,
  baseFeeInCents: 500000,
  deliveryFeeInCents: 1000000,
};

describe('toCreatePayload', () => {
  it('trims every field before sending it', () => {
    const payload = toCreatePayload('product-1', 2, delivery);

    expect(payload.customer.fullName).toBe('Ana Pérez');
    expect(payload.customer.email).toBe('ana.perez@example.com');
    expect(payload.delivery.addressLine1).toBe('Calle 123 # 45-67');
  });

  it('reuses the buyer name and phone as the delivery recipient', () => {
    const payload = toCreatePayload('product-1', 1, delivery);

    expect(payload.delivery.recipientName).toBe('Ana Pérez');
    expect(payload.delivery.recipientPhone).toBe('+573001112233');
  });

  it('omits the optional fields when they are blank', () => {
    const payload = toCreatePayload('product-1', 1, { ...delivery, legalIdNumber: '', postalCode: '' });

    expect(payload.customer.legalIdType).toBeUndefined();
    expect(payload.delivery.postalCode).toBeUndefined();
  });

  it('defaults the country to Colombia', () => {
    expect(toCreatePayload('product-1', 1, delivery).delivery.country).toBe('CO');
  });
});

describe('payment slice', () => {
  it('starts idle', () => {
    expect(paymentReducer(undefined, { type: '@@INIT' })).toEqual(initialPaymentState);
  });

  it('clears itself on reset', () => {
    const dirty = { status: 'failed' as const, transaction: transaction(), error: 'boom' };

    expect(paymentReducer(dirty, paymentReset())).toEqual(initialPaymentState);
  });
});

describe('payNow', () => {
  const args = { productId: 'product-1', quantity: 2, delivery, card, installments: 1 };

  it('registers the transaction, tokenizes the card and charges it', async () => {
    mockedApi.createTransaction.mockResolvedValue(transaction({ status: 'PENDING' }));
    mockedApi.getCheckoutConfig.mockResolvedValue(config);
    mockedTokenize.mockResolvedValue({ token: 'tok_1', brand: 'VISA', lastFour: '4242' });
    mockedApi.payTransaction.mockResolvedValue(transaction());

    const store = makeStore();
    await store.dispatch(payNow(args));

    expect(mockedApi.createTransaction).toHaveBeenCalledTimes(1);
    expect(mockedTokenize).toHaveBeenCalledWith(card, config);
    expect(mockedApi.payTransaction).toHaveBeenCalledWith('TX-REF-1', {
      cardToken: 'tok_1',
      acceptanceToken: 'acc_test',
      installments: 1,
      cardBrand: 'VISA',
      cardLastFour: '4242',
    });
    expect(store.getState().payment.status).toBe('settled');
  });

  it('shows the pending transaction while the charge is still being created', async () => {
    mockedApi.createTransaction.mockResolvedValue(transaction({ status: 'PENDING' }));
    mockedApi.getCheckoutConfig.mockResolvedValue(config);
    mockedTokenize.mockResolvedValue({ token: 'tok_1', brand: 'VISA', lastFour: '4242' });
    mockedApi.payTransaction.mockResolvedValue(transaction({ status: 'PENDING' }));

    const store = makeStore();
    await store.dispatch(payNow(args));

    expect(store.getState().payment.status).toBe('polling');
  });

  it('forwards the personal data authorization when the gateway requires it', async () => {
    mockedApi.createTransaction.mockResolvedValue(transaction({ status: 'PENDING' }));
    mockedApi.getCheckoutConfig.mockResolvedValue({ ...config, personalDataAuthToken: 'auth_1' });
    mockedTokenize.mockResolvedValue({ token: 'tok_1', brand: 'VISA', lastFour: '4242' });
    mockedApi.payTransaction.mockResolvedValue(transaction());

    await makeStore().dispatch(payNow(args));

    expect(mockedApi.payTransaction).toHaveBeenCalledWith(
      'TX-REF-1',
      expect.objectContaining({ personalDataAuthToken: 'auth_1' }),
    );
  });

  it('stops before tokenizing when the transaction cannot be created', async () => {
    mockedApi.createTransaction.mockRejectedValue(new Error('No hay unidades suficientes.'));

    const store = makeStore();
    await store.dispatch(payNow(args));

    expect(mockedTokenize).not.toHaveBeenCalled();
    expect(store.getState().payment.status).toBe('failed');
    expect(store.getState().payment.error).toBe('No hay unidades suficientes.');
  });

  it('keeps the pending transaction visible when tokenization fails', async () => {
    mockedApi.createTransaction.mockResolvedValue(transaction({ status: 'PENDING' }));
    mockedApi.getCheckoutConfig.mockResolvedValue(config);
    mockedTokenize.mockRejectedValue(new Error('La tarjeta fue rechazada.'));

    const store = makeStore();
    await store.dispatch(payNow(args));

    expect(store.getState().payment.status).toBe('failed');
    expect(store.getState().payment.transaction?.reference).toBe('TX-REF-1');
  });

  it('reports a failure from the charge itself', async () => {
    mockedApi.createTransaction.mockResolvedValue(transaction({ status: 'PENDING' }));
    mockedApi.getCheckoutConfig.mockResolvedValue(config);
    mockedTokenize.mockResolvedValue({ token: 'tok_1', brand: 'VISA', lastFour: '4242' });
    mockedApi.payTransaction.mockRejectedValue(new Error('La pasarela no respondió.'));

    const store = makeStore();
    await store.dispatch(payNow(args));

    expect(store.getState().payment.error).toBe('La pasarela no respondió.');
  });
});

describe('refreshTransaction', () => {
  it('replaces the stored transaction with the latest status', async () => {
    mockedApi.getTransaction.mockResolvedValue(transaction({ status: 'DECLINED' }));

    const store = makeStore();
    await store.dispatch(refreshTransaction('TX-REF-1'));

    expect(store.getState().payment.transaction?.status).toBe('DECLINED');
    expect(store.getState().payment.status).toBe('settled');
  });

  it('stays in polling while the transaction is pending', async () => {
    mockedApi.getTransaction.mockResolvedValue(transaction({ status: 'PENDING' }));

    const store = makeStore();
    await store.dispatch(refreshTransaction('TX-REF-1'));

    expect(store.getState().payment.status).toBe('polling');
  });

  it('records the error when the lookup fails', async () => {
    mockedApi.getTransaction.mockRejectedValue(new Error('No pudimos consultar la transacción.'));

    const store = makeStore();
    await store.dispatch(refreshTransaction('TX-REF-1'));

    expect(store.getState().payment.error).toBe('No pudimos consultar la transacción.');
  });
});
