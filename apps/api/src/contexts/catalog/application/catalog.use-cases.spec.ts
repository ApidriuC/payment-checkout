import { buildProduct, InMemoryProductRepository } from '@test/fakes/in-memory-repositories';

import { GetProductStockUseCase } from './get-product-stock.use-case';
import { GetProductUseCase } from './get-product.use-case';
import { ListProductsUseCase } from './list-products.use-case';

const setup = () => {
  const products = new InMemoryProductRepository();
  products.add(buildProduct());
  products.add(buildProduct({ id: 'product-2', sku: 'TEC-NOVA-87', name: 'Teclado Nova 87' }));

  return {
    products,
    listProducts: new ListProductsUseCase(products),
    getProduct: new GetProductUseCase(products),
    getStock: new GetProductStockUseCase(products),
  };
};

describe('ListProductsUseCase', () => {
  it('returns the whole catalog', async () => {
    const { listProducts } = setup();

    const result = await listProducts.execute();

    expect(result.ok && result.value).toHaveLength(2);
  });

  it('returns an empty catalog without failing', async () => {
    const listProducts = new ListProductsUseCase(new InMemoryProductRepository());

    const result = await listProducts.execute();

    expect(result.ok && result.value).toEqual([]);
  });
});

describe('GetProductUseCase', () => {
  it('returns the requested product', async () => {
    const { getProduct } = setup();

    const result = await getProduct.execute('product-2');

    expect(result.ok && result.value.sku).toBe('TEC-NOVA-87');
  });

  it('fails for an unknown product', async () => {
    const { getProduct } = setup();

    const result = await getProduct.execute('missing');

    expect(result.ok ? null : result.error.code).toBe('PRODUCT_NOT_FOUND');
  });
});

describe('GetProductStockUseCase', () => {
  it('returns the current stock', async () => {
    const { getStock } = setup();

    const result = await getStock.execute('product-1');

    expect(result.ok && result.value.availableUnits).toBe(12);
  });

  it('fails for a product without stock', async () => {
    const { getStock } = setup();

    const result = await getStock.execute('missing');

    expect(result.ok ? null : result.error.code).toBe('STOCK_NOT_FOUND');
  });
});
