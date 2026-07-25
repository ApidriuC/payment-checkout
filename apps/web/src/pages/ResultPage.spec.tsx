import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { api } from '@/api/client';
import type { Transaction, TransactionStatus } from '@/api/types';
import { renderWithProviders } from '@test/render';

import { ResultPage } from './ResultPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ reference: 'TX-REF-1' }),
}));

jest.mock('@/api/client', () => ({
  api: { getTransaction: jest.fn(), listProducts: jest.fn() },
  toApiError: (cause: unknown) => ({
    message: cause instanceof Error ? cause.message : 'error',
  }),
}));

const mockedApi = api as jest.Mocked<typeof api>;

const transaction = (status: TransactionStatus, overrides: Partial<Transaction> = {}): Transaction => ({
  reference: 'TX-REF-1',
  status,
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

beforeEach(() => {
  mockedApi.listProducts.mockResolvedValue([]);
});

describe('ResultPage', () => {
  it('rebuilds the outcome from the backend, so a refresh keeps it', async () => {
    mockedApi.getTransaction.mockResolvedValue(transaction('APPROVED'));

    renderWithProviders(<ResultPage />);

    expect(await screen.findByText('¡Pago aprobado!')).toBeInTheDocument();
    expect(mockedApi.getTransaction).toHaveBeenCalledWith('TX-REF-1');
  });

  it('shows the transaction reference and total', async () => {
    mockedApi.getTransaction.mockResolvedValue(transaction('APPROVED'));

    renderWithProviders(<ResultPage />);

    expect(await screen.findByTestId('result-reference')).toHaveTextContent('TX-REF-1');
    expect(screen.getByText(/934\.800/)).toBeInTheDocument();
  });

  it('shows the card brand and last four digits', async () => {
    mockedApi.getTransaction.mockResolvedValue(transaction('APPROVED'));

    renderWithProviders(<ResultPage />);

    expect(await screen.findByText('VISA •••• 4242')).toBeInTheDocument();
  });

  it.each([
    ['DECLINED' as const, 'Pago rechazado'],
    ['VOIDED' as const, 'Pago anulado'],
    ['ERROR' as const, 'No pudimos completar el pago'],
    ['PENDING' as const, 'Estamos procesando tu pago'],
  ])('renders the %s outcome', async (status, title) => {
    mockedApi.getTransaction.mockResolvedValue(transaction(status));

    renderWithProviders(<ResultPage />);

    expect(await screen.findByText(title)).toBeInTheDocument();
  });

  it('shows the reason the bank gave', async () => {
    mockedApi.getTransaction.mockResolvedValue(
      transaction('DECLINED', { failureReason: 'Fondos insuficientes' }),
    );

    renderWithProviders(<ResultPage />);

    expect(await screen.findByText('Fondos insuficientes')).toBeInTheDocument();
  });

  it('keeps polling while the payment is still pending', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    mockedApi.getTransaction.mockResolvedValue(transaction('PENDING'));

    renderWithProviders(<ResultPage />);
    await screen.findByText('Estamos procesando tu pago');

    mockedApi.getTransaction.mockResolvedValue(transaction('APPROVED'));
    jest.advanceTimersByTime(3000);

    expect(await screen.findByText('¡Pago aprobado!')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('stops polling once the transaction is settled', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    mockedApi.getTransaction.mockResolvedValue(transaction('APPROVED'));

    renderWithProviders(<ResultPage />);
    await screen.findByText('¡Pago aprobado!');

    const callsAfterLoad = mockedApi.getTransaction.mock.calls.length;
    jest.advanceTimersByTime(12000);

    expect(mockedApi.getTransaction).toHaveBeenCalledTimes(callsAfterLoad);
    jest.useRealTimers();
  });

  it('shows a loading state until the transaction arrives', () => {
    mockedApi.getTransaction.mockReturnValue(new Promise(() => undefined));

    renderWithProviders(<ResultPage />);

    expect(screen.getByText('Consultando tu transacción…')).toBeInTheDocument();
  });

  it('reports a lookup failure', async () => {
    mockedApi.getTransaction.mockRejectedValue(new Error('No pudimos consultar la transacción.'));

    renderWithProviders(<ResultPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos consultar la transacción.',
    );
  });

  it('clears the checkout and reloads the catalog on the way back to the store', async () => {
    mockedApi.getTransaction.mockResolvedValue(transaction('APPROVED'));
    const user = userEvent.setup();

    const { store } = renderWithProviders(<ResultPage />, {
      preloadedState: {
        checkout: {
          step: 'result',
          productId: 'product-1',
          quantity: 2,
          delivery: { ...store0Delivery },
          card: { brand: 'VISA', lastFour: '4242', holder: 'ANA PEREZ' },
          reference: 'TX-REF-1',
        },
      },
    });

    await screen.findByText('¡Pago aprobado!');
    await user.click(screen.getByRole('button', { name: 'Volver a la tienda' }));

    await waitFor(() => expect(store.getState().checkout.productId).toBeNull());
    expect(store.getState().payment.transaction).toBeNull();
    expect(mockedApi.listProducts).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });
});

const store0Delivery = {
  fullName: 'Ana Pérez',
  email: 'ana.perez@example.com',
  phoneNumber: '+573001112233',
  legalIdType: 'CC',
  legalIdNumber: '1020304050',
  addressLine1: 'Calle 123 # 45-67',
  addressLine2: '',
  city: 'Medellín',
  region: 'Antioquia',
  postalCode: '',
};
