import { Inject, Injectable } from '@nestjs/common';

import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '@/contexts/catalog/domain/ports/product.repository';
import { type Product } from '@/contexts/catalog/domain/product';
import { type DomainError } from '@/shared/domain/domain-error';
import { type AsyncResult } from '@/shared/domain/result';

@Injectable()
export class GetProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
  ) {}

  execute(productId: string): AsyncResult<Product, DomainError> {
    return this.products.findById(productId);
  }
}
