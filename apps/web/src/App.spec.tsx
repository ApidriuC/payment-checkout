import { screen } from '@testing-library/react';

import { api } from '@/api/client';
import { renderWithProviders } from '@test/render';

import { App } from './App';

jest.mock('@/api/client', () => ({
  api: { listProducts: jest.fn(), getTransaction: jest.fn(), getCheckoutConfig: jest.fn() },
  toApiError: (cause: unknown) => ({
    message: cause instanceof Error ? cause.message : 'error',
  }),
}));

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  mockedApi.listProducts.mockResolvedValue([]);
  mockedApi.getTransaction.mockReturnValue(new Promise(() => undefined));
});

describe('App', () => {
  it('renders the product page at the root', async () => {
    renderWithProviders(<App />, { route: '/' });

    expect(await screen.findByText('Tecnología para tu escritorio')).toBeInTheDocument();
  });

  it('shows the progress stepper', () => {
    renderWithProviders(<App />, { route: '/' });

    expect(screen.getByLabelText('Progreso del checkout')).toBeInTheDocument();
  });

  it('renders the result page for a transaction reference', () => {
    renderWithProviders(<App />, { route: '/result/TX-REF-1' });

    expect(screen.getByText('Consultando tu transacción…')).toBeInTheDocument();
  });

  it('redirects an unknown route to the store', async () => {
    renderWithProviders(<App />, { route: '/no-existe' });

    expect(await screen.findByText('Tecnología para tu escritorio')).toBeInTheDocument();
  });

  it('states that card data is not stored', () => {
    renderWithProviders(<App />, { route: '/' });

    expect(
      screen.getByText('Pagos procesados de forma segura. No almacenamos los datos de tu tarjeta.'),
    ).toBeInTheDocument();
  });
});
