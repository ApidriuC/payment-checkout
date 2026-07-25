import { Stock } from '@/contexts/catalog/domain/stock';
import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';
import { fakeDataSource } from '@test/fakes/fake-data-source';

import { ProductOrmEntity } from './product.orm-entity';
import { StockItemOrmEntity } from './stock-item.orm-entity';
import { TypeOrmProductRepository } from './typeorm-product.repository';

const productRow = (overrides: Partial<ProductOrmEntity> = {}): ProductOrmEntity =>
  ({
    id: 'product-1',
    sku: 'AUD-ORBIT-01',
    name: 'Audífonos Orbit Pro',
    description: 'Audífonos over-ear.',
    priceInCents: 45990000,
    currency: 'COP',
    imageUrl: '/images/products/orbit-headphones.svg',
    stock: { productId: 'product-1', availableUnits: 12, reservedUnits: 0, version: 1 },
    ...overrides,
  }) as ProductOrmEntity;

const stockRow = (overrides: Partial<StockItemOrmEntity> = {}): StockItemOrmEntity =>
  ({
    id: 'stock-1',
    productId: 'product-1',
    availableUnits: 12,
    reservedUnits: 0,
    version: 1,
    ...overrides,
  }) as StockItemOrmEntity;

let CONTEXT: TransactionContext;

const setup = () => {
  const { dataSource, context, repositoryFor } = fakeDataSource();
  CONTEXT = context;

  return {
    repository: new TypeOrmProductRepository(dataSource),
    products: repositoryFor(ProductOrmEntity),
    stocks: repositoryFor(StockItemOrmEntity),
  };
};

describe('TypeOrmProductRepository', () => {
  describe('findAll', () => {
    it('maps every row into a domain product', async () => {
      const { repository, products } = setup();
      products.find.mockResolvedValue([productRow(), productRow({ id: 'product-2', sku: 'X' })]);

      const result = await repository.findAll();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
      expect(result.value[0].price.amountInCents).toBe(45990000);
    });

    it('defaults the stock to zero when a product has none', async () => {
      const { repository, products } = setup();
      products.find.mockResolvedValue([productRow({ stock: undefined })]);

      const result = await repository.findAll();

      expect(result.ok && result.value[0].stock.availableUnits).toBe(0);
    });

    it('fails when a stored row breaks a domain invariant', async () => {
      const { repository, products } = setup();
      products.find.mockResolvedValue([productRow({ priceInCents: -1 })]);

      const result = await repository.findAll();

      expect(result.ok).toBe(false);
    });

    it('turns a driver failure into a domain error', async () => {
      const { repository, products } = setup();
      products.find.mockRejectedValue(new Error('connection lost'));

      const result = await repository.findAll();

      expect(result.ok ? null : result.error.code).toBe('UNEXPECTED_ERROR');
    });
  });

  describe('findById', () => {
    it('returns the product', async () => {
      const { repository, products } = setup();
      products.findOne.mockResolvedValue(productRow());

      const result = await repository.findById('product-1');

      expect(result.ok && result.value.sku).toBe('AUD-ORBIT-01');
    });

    it('fails when the product is missing', async () => {
      const { repository, products } = setup();
      products.findOne.mockResolvedValue(null);

      const result = await repository.findById('missing');

      expect(result.ok ? null : result.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('turns a driver failure into a domain error', async () => {
      const { repository, products } = setup();
      products.findOne.mockRejectedValue(new Error('boom'));

      const result = await repository.findById('product-1');

      expect(result.ok ? null : result.error.code).toBe('UNEXPECTED_ERROR');
    });
  });

  describe('findStockByProductId', () => {
    it('returns the stock', async () => {
      const { repository, stocks } = setup();
      stocks.findOne.mockResolvedValue(stockRow({ availableUnits: 7, reservedUnits: 2 }));

      const result = await repository.findStockByProductId('product-1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.availableUnits).toBe(7);
      expect(result.value.reservedUnits).toBe(2);
    });

    it('fails when the product has no stock row', async () => {
      const { repository, stocks } = setup();
      stocks.findOne.mockResolvedValue(null);

      const result = await repository.findStockByProductId('product-1');

      expect(result.ok ? null : result.error.code).toBe('STOCK_NOT_FOUND');
    });

    it('turns a driver failure into a domain error', async () => {
      const { repository, stocks } = setup();
      stocks.findOne.mockRejectedValue(new Error('boom'));

      const result = await repository.findStockByProductId('product-1');

      expect(result.ok ? null : result.error.code).toBe('UNEXPECTED_ERROR');
    });
  });

  describe('lockStockByProductId', () => {
    it('requests a pessimistic write lock', async () => {
      const { repository, stocks } = setup();
      stocks.findOne.mockResolvedValue(stockRow());

      await repository.lockStockByProductId('product-1', CONTEXT);

      expect(stocks.findOne).toHaveBeenCalledWith({
        where: { productId: 'product-1' },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('fails when the stock row does not exist', async () => {
      const { repository, stocks } = setup();
      stocks.findOne.mockResolvedValue(null);

      const result = await repository.lockStockByProductId('product-1', CONTEXT);

      expect(result.ok ? null : result.error.code).toBe('STOCK_NOT_FOUND');
    });

    it('turns a lock failure into a domain error', async () => {
      const { repository, stocks } = setup();
      stocks.findOne.mockRejectedValue(new Error('deadlock'));

      const result = await repository.lockStockByProductId('product-1', CONTEXT);

      expect(result.ok ? null : result.error.code).toBe('UNEXPECTED_ERROR');
    });
  });

  describe('saveStock', () => {
    const stock = (): Stock =>
      Stock.rehydrate({ productId: 'product-1', availableUnits: 10, reservedUnits: 2, version: 3 });

    it('updates only the row still holding the expected version', async () => {
      const { repository, stocks } = setup();
      stocks.update.mockResolvedValue({ affected: 1 });
      stocks.findOne.mockResolvedValue(stockRow({ availableUnits: 10, reservedUnits: 2 }));

      await repository.saveStock(stock(), CONTEXT);

      expect(stocks.update).toHaveBeenCalledWith(
        { productId: 'product-1', version: 3 },
        { availableUnits: 10, reservedUnits: 2 },
      );
    });

    it('returns the stored stock after a successful write', async () => {
      const { repository, stocks } = setup();
      stocks.update.mockResolvedValue({ affected: 1 });
      stocks.findOne.mockResolvedValue(stockRow({ availableUnits: 10, reservedUnits: 2 }));

      const result = await repository.saveStock(stock(), CONTEXT);

      expect(result.ok && result.value.availableUnits).toBe(10);
    });

    it('reports a conflict when another checkout won the race', async () => {
      const { repository, stocks } = setup();
      stocks.update.mockResolvedValue({ affected: 0 });

      const result = await repository.saveStock(stock(), CONTEXT);

      expect(result.ok ? null : result.error.code).toBe('STOCK_CONCURRENCY_CONFLICT');
    });

    it('turns a write failure into a domain error', async () => {
      const { repository, stocks } = setup();
      stocks.update.mockRejectedValue(new Error('boom'));

      const result = await repository.saveStock(stock(), CONTEXT);

      expect(result.ok ? null : result.error.code).toBe('UNEXPECTED_ERROR');
    });
  });
});
