import { type HttpException } from '@nestjs/common';

import { GetProductStockUseCase } from '@/contexts/catalog/application/get-product-stock.use-case';
import { GetProductUseCase } from '@/contexts/catalog/application/get-product.use-case';
import { ListProductsUseCase } from '@/contexts/catalog/application/list-products.use-case';
import { buildProduct, InMemoryProductRepository } from '@test/fakes/in-memory-repositories';

import { ProductsController } from './products.controller';

const setup = () => {
  const products = new InMemoryProductRepository();
  products.add(buildProduct());

  return {
    controller: new ProductsController(
      new ListProductsUseCase(products),
      new GetProductUseCase(products),
      new GetProductStockUseCase(products),
    ),
  };
};

describe('ProductsController', () => {
  describe('GET /products', () => {
    it('exposes the catalog with price and available units', async () => {
      const { controller } = setup();

      const response = await controller.findAll();

      expect(response).toEqual([
        {
          id: 'product-1',
          sku: 'AUD-ORBIT-01',
          name: 'Audífonos Orbit Pro',
          description: 'Audífonos over-ear.',
          priceInCents: 45990000,
          currency: 'COP',
          imageUrl: '/images/products/orbit-headphones.svg',
          availableUnits: 12,
        },
      ]);
    });
  });

  describe('GET /products/:id', () => {
    it('returns the product detail', async () => {
      const { controller } = setup();

      const response = await controller.findOne('product-1');

      expect(response.sku).toBe('AUD-ORBIT-01');
    });

    it('answers 404 when the product does not exist', async () => {
      const { controller } = setup();

      await expect(controller.findOne('missing')).rejects.toMatchObject({ status: 404 });
    });

    it('reports the domain error code in the body', async () => {
      const { controller } = setup();

      await controller.findOne('missing').catch((error: HttpException) => {
        expect(error.getResponse()).toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
      });
    });
  });

  describe('GET /products/:id/stock', () => {
    it('returns available and reserved units', async () => {
      const { controller } = setup();

      const response = await controller.findStock('product-1');

      expect(response).toEqual({
        productId: 'product-1',
        availableUnits: 12,
        reservedUnits: 0,
      });
    });

    it('answers 404 when the product has no stock', async () => {
      const { controller } = setup();

      await expect(controller.findStock('missing')).rejects.toMatchObject({ status: 404 });
    });
  });
});
