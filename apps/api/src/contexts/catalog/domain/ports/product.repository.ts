import { type TransactionContext } from '@/shared/application/ports/unit-of-work.port';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult } from '@/shared/domain/result';

import { type Product } from '../product';
import { type Stock } from '../stock';

export const PRODUCT_REPOSITORY = Symbol('ProductRepository');

export interface ProductRepository {
  findAll(): AsyncResult<Product[], DomainError>;

  findById(id: string, context?: TransactionContext): AsyncResult<Product, DomainError>;

  findStockByProductId(
    productId: string,
    context?: TransactionContext,
  ): AsyncResult<Stock, DomainError>;

  /** Locks the stock row for the rest of the transaction to serialize concurrent checkouts. */
  lockStockByProductId(
    productId: string,
    context: TransactionContext,
  ): AsyncResult<Stock, DomainError>;

  saveStock(stock: Stock, context: TransactionContext): AsyncResult<Stock, DomainError>;
}
