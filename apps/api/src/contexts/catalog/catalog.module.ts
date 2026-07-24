import { Module } from '@nestjs/common';

import { GetProductStockUseCase } from './application/get-product-stock.use-case';
import { GetProductUseCase } from './application/get-product.use-case';
import { ListProductsUseCase } from './application/list-products.use-case';
import { PRODUCT_REPOSITORY } from './domain/ports/product.repository';
import { ProductsController } from './infrastructure/http/products.controller';
import { TypeOrmProductRepository } from './infrastructure/persistence/typeorm-product.repository';

@Module({
  controllers: [ProductsController],
  providers: [
    ListProductsUseCase,
    GetProductUseCase,
    GetProductStockUseCase,
    { provide: PRODUCT_REPOSITORY, useClass: TypeOrmProductRepository },
  ],
  exports: [PRODUCT_REPOSITORY],
})
export class CatalogModule {}
