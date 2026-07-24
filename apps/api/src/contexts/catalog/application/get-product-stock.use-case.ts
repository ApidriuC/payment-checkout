import { Inject, Injectable } from '@nestjs/common';

import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '@/contexts/catalog/domain/ports/product.repository';
import { type Stock } from '@/contexts/catalog/domain/stock';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult } from '@/shared/domain/result';

@Injectable()
export class GetProductStockUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
  ) {}

  execute(productId: string): AsyncResult<Stock, DomainError> {
    return this.products.findStockByProductId(productId);
  }
}
