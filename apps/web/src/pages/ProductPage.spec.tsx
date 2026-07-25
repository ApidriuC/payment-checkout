import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { api } from '@/api/client';
import type { Product } from '@/api/types';
import { renderWithProviders } from '@test/render';

import { ProductPage } from './ProductPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('@/api/client', () => ({
  api: { listProducts: jest.fn() },
  toApiError: (cause: unknown) => ({
    message: cause instanceof Error ? cause.message : 'error',
  }),
}));

const mockedApi = api as jest.Mocked<typeof api>;

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'product-1',
  sku: 'AUD-ORBIT-01',
  name: 'Audífonos Orbit Pro',
  description: 'Audífonos over-ear con cancelación activa de ruido.',
  priceInCents: 45990000,
  currency: 'COP',
  imageUrl: '/images/products/orbit-headphones.svg',
  availableUnits: 12,
  ...overrides,
});

describe('ProductPage', () => {
  it('shows a loading state while the catalog is fetched', () => {
    mockedApi.listProducts.mockReturnValue(new Promise(() => undefined));

    renderWithProviders(<ProductPage />);

    expect(screen.getByText('Cargando productos…')).toBeInTheDocument();
  });

  it('lists the product with its description, price and stock', async () => {
    mockedApi.listProducts.mockResolvedValue([product()]);

    renderWithProviders(<ProductPage />);

    expect(await screen.findByText('Audífonos Orbit Pro')).toBeInTheDocument();
    expect(
      screen.getByText('Audífonos over-ear con cancelación activa de ruido.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('stock-AUD-ORBIT-01')).toHaveTextContent('12 unidades disponibles');
  });

  it('formats the price in Colombian pesos', async () => {
    mockedApi.listProducts.mockResolvedValue([product()]);

    renderWithProviders(<ProductPage />);

    expect(await screen.findByText(/459\.900/)).toBeInTheDocument();
  });

  it('uses the singular wording for a single unit', async () => {
    mockedApi.listProducts.mockResolvedValue([product({ availableUnits: 1 })]);

    renderWithProviders(<ProductPage />);

    expect(await screen.findByTestId('stock-AUD-ORBIT-01')).toHaveTextContent(
      '1 unidad disponible',
    );
  });

  it('marks a sold out product and disables its button', async () => {
    mockedApi.listProducts.mockResolvedValue([product({ availableUnits: 0 })]);

    renderWithProviders(<ProductPage />);

    expect(await screen.findByTestId('stock-AUD-ORBIT-01')).toHaveTextContent('Agotado');
    expect(screen.getByRole('button', { name: 'Pagar con tarjeta' })).toBeDisabled();
  });

  it('renders the product image with an accessible name', async () => {
    mockedApi.listProducts.mockResolvedValue([product()]);

    renderWithProviders(<ProductPage />);

    const image = await screen.findByAltText('Audífonos Orbit Pro');
    expect(image).toHaveAttribute('src', '/images/products/orbit-headphones.svg');
    expect(image).toHaveAttribute('loading', 'lazy');
  });

  it('starts the checkout with the selected quantity', async () => {
    mockedApi.listProducts.mockResolvedValue([product()]);
    const user = userEvent.setup();

    const { store } = renderWithProviders(<ProductPage />);
    await screen.findByText('Audífonos Orbit Pro');

    await user.selectOptions(screen.getByRole('combobox'), '3');
    await user.click(screen.getByRole('button', { name: 'Pagar con tarjeta' }));

    expect(store.getState().checkout).toMatchObject({
      productId: 'product-1',
      quantity: 3,
      step: 'details',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/checkout');
  });

  it('defaults the quantity to one unit', async () => {
    mockedApi.listProducts.mockResolvedValue([product()]);
    const user = userEvent.setup();

    const { store } = renderWithProviders(<ProductPage />);
    await screen.findByText('Audífonos Orbit Pro');

    await user.click(screen.getByRole('button', { name: 'Pagar con tarjeta' }));

    expect(store.getState().checkout.quantity).toBe(1);
  });

  it('caps the quantity selector at the available units', async () => {
    mockedApi.listProducts.mockResolvedValue([product({ availableUnits: 3 })]);

    renderWithProviders(<ProductPage />);
    await screen.findByText('Audífonos Orbit Pro');

    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('shows the error and lets the buyer retry', async () => {
    mockedApi.listProducts.mockRejectedValueOnce(new Error('No pudimos cargar los productos.'));
    const user = userEvent.setup();

    renderWithProviders(<ProductPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los productos.');

    mockedApi.listProducts.mockResolvedValue([product()]);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(screen.getByText('Audífonos Orbit Pro')).toBeInTheDocument());
  });
});
