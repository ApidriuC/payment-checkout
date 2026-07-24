import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  ProductNotFoundError,
  StockConcurrencyError,
  StockNotFoundError,
} from '@/contexts/catalog/domain/errors';
import { type ProductRepository } from '@/contexts/catalog/domain/ports/product.repository';
import { Product } from '@/contexts/catalog/domain/product';
import { Stock } from '@/contexts/catalog/domain/stock';
import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError, UnexpectedError } from '@/shared/domain/domain-error';
import {
  type AsyncResult,
  combine,
  err,
  fromPromise,
  ok,
  type Result,
} from '@/shared/domain/result';
import { managerFrom } from '@/shared/infrastructure/persistence/typeorm/typeorm-unit-of-work';

import { ProductOrmEntity } from './product.orm-entity';
import { StockItemOrmEntity } from './stock-item.orm-entity';

@Injectable()
export class TypeOrmProductRepository implements ProductRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(): AsyncResult<Product[], DomainError> {
    const rows = await fromPromise(
      this.dataSource.getRepository(ProductOrmEntity).find({
        relations: { stock: true },
        order: { name: 'ASC' },
      }),
      (cause) => new UnexpectedError('No se pudo consultar el catálogo.', cause),
    );

    if (!rows.ok) {
      return rows;
    }

    return combine(rows.value.map((row) => this.toDomain(row)));
  }

  async findById(id: string, context?: TransactionContext): AsyncResult<Product, DomainError> {
    const row = await fromPromise(
      managerFrom(this.dataSource, context).getRepository(ProductOrmEntity).findOne({
        where: { id },
        relations: { stock: true },
      }),
      (cause) => new UnexpectedError('No se pudo consultar el producto.', cause),
    );

    if (!row.ok) {
      return row;
    }
    if (!row.value) {
      return err(new ProductNotFoundError(id));
    }

    return this.toDomain(row.value);
  }

  async findStockByProductId(
    productId: string,
    context?: TransactionContext,
  ): AsyncResult<Stock, DomainError> {
    const row = await fromPromise(
      managerFrom(this.dataSource, context)
        .getRepository(StockItemOrmEntity)
        .findOne({ where: { productId } }),
      (cause) => new UnexpectedError('No se pudo consultar el stock.', cause),
    );

    if (!row.ok) {
      return row;
    }
    if (!row.value) {
      return err(new StockNotFoundError(productId));
    }

    return ok(this.toStock(row.value));
  }

  async lockStockByProductId(
    productId: string,
    context: TransactionContext,
  ): AsyncResult<Stock, DomainError> {
    const row = await fromPromise(
      managerFrom(this.dataSource, context)
        .getRepository(StockItemOrmEntity)
        .findOne({ where: { productId }, lock: { mode: 'pessimistic_write' } }),
      (cause) => new UnexpectedError('No se pudo bloquear el stock.', cause),
    );

    if (!row.ok) {
      return row;
    }
    if (!row.value) {
      return err(new StockNotFoundError(productId));
    }

    return ok(this.toStock(row.value));
  }

  async saveStock(stock: Stock, context: TransactionContext): AsyncResult<Stock, DomainError> {
    const snapshot = stock.toSnapshot();

    const updated = await fromPromise(
      managerFrom(this.dataSource, context)
        .getRepository(StockItemOrmEntity)
        .update(
          { productId: snapshot.productId, version: snapshot.version },
          { availableUnits: snapshot.availableUnits, reservedUnits: snapshot.reservedUnits },
        ),
      (cause) => new UnexpectedError('No se pudo actualizar el stock.', cause),
    );

    if (!updated.ok) {
      return updated;
    }

    // A zero-row update means another checkout changed the row first.
    if (updated.value.affected === 0) {
      return err(new StockConcurrencyError(snapshot.productId));
    }

    return this.findStockByProductId(snapshot.productId, context);
  }

  private toDomain(row: ProductOrmEntity): Result<Product, DomainError> {
    return Product.rehydrate({
      id: row.id,
      sku: row.sku,
      name: row.name,
      description: row.description,
      priceInCents: row.priceInCents,
      currency: row.currency,
      imageUrl: row.imageUrl,
      stock: {
        availableUnits: row.stock?.availableUnits ?? 0,
        reservedUnits: row.stock?.reservedUnits ?? 0,
        version: row.stock?.version ?? 1,
      },
    });
  }

  private toStock(row: StockItemOrmEntity): Stock {
    return Stock.rehydrate({
      productId: row.productId,
      availableUnits: row.availableUnits,
      reservedUnits: row.reservedUnits,
      version: row.version,
    });
  }
}
