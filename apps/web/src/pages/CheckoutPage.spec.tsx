import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { api } from '@/api/client';
import { tokenizeCard } from '@/api/tokenize-card';
import type { Product, Transaction } from '@/api/types';
import { EMPTY_DELIVERY } from '@/domain/delivery';
import { renderWithProviders } from '@test/render';

import { CheckoutPage } from './CheckoutPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('@/api/client', () => ({
  api: {
    listProducts: jest.fn(),
    getCheckoutConfig: jest.fn(),
    createTransaction: jest.fn(),
    payTransaction: jest.fn(),
    getTransaction: jest.fn(),
  },
  toApiError: (cause: unknown) => ({
    message: cause instanceof Error ? cause.message : 'error',
  }),
}));

jest.mock('@/api/tokenize-card', () => ({ tokenizeCard: jest.fn() }));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedTokenize = tokenizeCard as jest.MockedFunction<typeof tokenizeCard>;

const product: Product = {
  id: 'product-1',
  sku: 'AUD-ORBIT-01',
  name: 'Audífonos Orbit Pro',
  description: 'Audífonos over-ear.',
  priceInCents: 45990000,
  currency: 'COP',
  imageUrl: '/images/products/orbit-headphones.svg',
  availableUnits: 12,
};

const config = {
  publicKey: 'pub_test',
  tokenizationUrl: 'https://gateway.test/v1/tokens/cards',
  acceptanceToken: 'acc_test',
  personalDataAuthToken: null,
  termsUrl: null,
  baseFeeInCents: 500000,
  deliveryFeeInCents: 1000000,
};

const transaction: Transaction = {
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
};

const preloaded = {
  catalog: { products: [product], status: 'ready' as const, error: null },
  checkout: {
    step: 'details' as const,
    productId: 'product-1',
    quantity: 2,
    delivery: EMPTY_DELIVERY,
    card: null,
    reference: null,
  },
};

const fillDelivery = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Nombre completo'), 'Ana Pérez');
  await user.type(screen.getByLabelText('Correo electrónico'), 'ana.perez@example.com');
  await user.type(screen.getByLabelText('Teléfono'), '+573001112233');
  await user.type(screen.getByLabelText('Número'), '1020304050');
  await user.type(screen.getByLabelText('Dirección'), 'Calle 123 # 45-67');
  await user.type(screen.getByLabelText('Ciudad'), 'Medellín');
  await user.type(screen.getByLabelText('Departamento'), 'Antioquia');
};

const fillCard = async (user: ReturnType<typeof userEvent.setup>, number = '4242424242424242') => {
  await user.type(screen.getByLabelText('Número de tarjeta'), number);
  await user.type(screen.getByLabelText('Nombre en la tarjeta'), 'ANA PEREZ');
  await user.type(screen.getByLabelText('Vencimiento'), '1229');
  await user.type(screen.getByLabelText('CVC'), '123');
};

beforeEach(() => {
  mockedApi.getCheckoutConfig.mockResolvedValue(config);
});

describe('CheckoutPage', () => {
  it('shows the product being purchased', () => {
    renderWithProviders(<CheckoutPage />, { preloadedState: preloaded });

    expect(screen.getByText('2 × Audífonos Orbit Pro')).toBeInTheDocument();
  });

  it('sends the buyer home when no product was chosen', () => {
    renderWithProviders(<CheckoutPage />, {
      preloadedState: { ...preloaded, checkout: { ...preloaded.checkout, productId: null } },
    });

    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('formats the card number in groups of four as it is typed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CheckoutPage />, { preloadedState: preloaded });

    await user.type(screen.getByLabelText('Número de tarjeta'), '4242424242424242');

    expect(screen.getByLabelText('Número de tarjeta')).toHaveValue('4242 4242 4242 4242');
  });

  it('shows the Visa logo once the number identifies the brand', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CheckoutPage />, { preloadedState: preloaded });

    await user.type(screen.getByLabelText('Número de tarjeta'), '4242');

    expect(screen.getByTestId('brand-visa')).toBeInTheDocument();
  });

  it('shows the Mastercard logo for a Mastercard number', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CheckoutPage />, { preloadedState: preloaded });

    await user.type(screen.getByLabelText('Número de tarjeta'), '5555');

    expect(screen.getByTestId('brand-mastercard')).toBeInTheDocument();
  });

  it('blocks the summary and reports the invalid fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CheckoutPage />, { preloadedState: preloaded });

    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.queryByTestId('summary-backdrop')).not.toBeInTheDocument();
    expect(screen.getByText('Ingresa el número de la tarjeta.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu nombre completo.')).toBeInTheDocument();
  });

  it('rejects a card number that fails the checksum', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CheckoutPage />, { preloadedState: preloaded });

    await fillCard(user, '4242424242424243');
    await fillDelivery(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByText('El número de tarjeta no es válido.')).toBeInTheDocument();
  });

  it('opens the summary backdrop with the full amount breakdown', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CheckoutPage />, { preloadedState: preloaded });

    await fillCard(user);
    await fillDelivery(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    const backdrop = await screen.findByTestId('summary-backdrop');
    expect(within(backdrop).getByText('2 × Audífonos Orbit Pro')).toBeInTheDocument();
    expect(within(backdrop).getByText('Comisión base')).toBeInTheDocument();
    expect(within(backdrop).getByText('Envío')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(backdrop).getByTestId('summary-total')).toHaveTextContent(/934\.800/),
    );
  });

  it('goes back from the summary to the form', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<CheckoutPage />, { preloadedState: preloaded });

    await fillCard(user);
    await fillDelivery(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByTestId('summary-backdrop');

    await user.click(screen.getByRole('button', { name: 'Volver' }));

    expect(store.getState().checkout.step).toBe('details');
  });

  it('pays and navigates to the result page', async () => {
    mockedApi.createTransaction.mockResolvedValue({ ...transaction, status: 'PENDING' });
    mockedTokenize.mockResolvedValue({ token: 'tok_1', brand: 'VISA', lastFour: '4242' });
    mockedApi.payTransaction.mockResolvedValue(transaction);

    const user = userEvent.setup();
    renderWithProviders(<CheckoutPage />, { preloadedState: preloaded });

    await fillCard(user);
    await fillDelivery(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByTestId('summary-backdrop');

    await user.click(screen.getByRole('button', { name: /Pagar/ }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/result/TX-REF-1'));
  });

  it('never sends the raw card number to our own API', async () => {
    mockedApi.createTransaction.mockResolvedValue({ ...transaction, status: 'PENDING' });
    mockedTokenize.mockResolvedValue({ token: 'tok_1', brand: 'VISA', lastFour: '4242' });
    mockedApi.payTransaction.mockResolvedValue(transaction);

    const user = userEvent.setup();
    renderWithProviders(<CheckoutPage />, { preloadedState: preloaded });

    await fillCard(user);
    await fillDelivery(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByTestId('summary-backdrop');
    await user.click(screen.getByRole('button', { name: /Pagar/ }));

    await waitFor(() => expect(mockedApi.payTransaction).toHaveBeenCalled());
    const sent = JSON.stringify(mockedApi.payTransaction.mock.calls);
    expect(sent).not.toContain('4242424242424242');
    expect(sent).not.toContain('"123"');
  });

  it('keeps the buyer on the summary and shows the reason when the payment fails', async () => {
    mockedApi.createTransaction.mockRejectedValue(new Error('No hay unidades suficientes.'));

    const user = userEvent.setup();
    renderWithProviders(<CheckoutPage />, { preloadedState: preloaded });

    await fillCard(user);
    await fillDelivery(user);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByTestId('summary-backdrop');
    await user.click(screen.getByRole('button', { name: /Pagar/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay unidades suficientes.');
    expect(mockNavigate).not.toHaveBeenCalledWith('/result/TX-REF-1');
  });

  it('returns to the summary form after a refresh, since the card is never persisted', () => {
    const { store } = renderWithProviders(<CheckoutPage />, {
      preloadedState: {
        ...preloaded,
        checkout: {
          ...preloaded.checkout,
          step: 'summary',
          card: { brand: 'VISA', lastFour: '4242', holder: 'ANA PEREZ' },
        },
      },
    });

    expect(screen.queryByTestId('summary-backdrop')).not.toBeInTheDocument();
    expect(store.getState().checkout.step).toBe('details');
  });

  it('keeps the delivery data typed before the refresh', () => {
    renderWithProviders(<CheckoutPage />, {
      preloadedState: {
        ...preloaded,
        checkout: {
          ...preloaded.checkout,
          delivery: { ...EMPTY_DELIVERY, city: 'Medellín', fullName: 'Ana Pérez' },
        },
      },
    });

    expect(screen.getByLabelText('Ciudad')).toHaveValue('Medellín');
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('Ana Pérez');
  });

  it('cancels back to the store', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CheckoutPage />, { preloadedState: preloaded });

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
