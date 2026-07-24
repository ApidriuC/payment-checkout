import { type DomainError } from '@/shared/domain/domain-error';
import { Money } from '@/shared/domain/money';
import { err, map, type Result } from '@/shared/domain/result';

import { InvalidQuantityError } from './errors';
import { Stock } from './stock';

export interface ProductSnapshot {
  id: string;
  sku: string;
  name: string;
  description: string;
  priceInCents: number;
  currency: string;
  imageUrl: string;
  stock: {
    availableUnits: number;
    reservedUnits: number;
    version: number;
  };
}

export class Product {
  private constructor(
    readonly id: string,
    readonly sku: string,
    readonly name: string,
    readonly description: string,
    readonly price: Money,
    readonly imageUrl: string,
    readonly stock: Stock,
  ) {}

  static rehydrate(snapshot: ProductSnapshot): Result<Product, DomainError> {
    return map(
      Money.fromCents(snapshot.priceInCents, snapshot.currency),
      (price) =>
        new Product(
          snapshot.id,
          snapshot.sku,
          snapshot.name,
          snapshot.description,
          price,
          snapshot.imageUrl,
          Stock.rehydrate({ productId: snapshot.id, ...snapshot.stock }),
        ),
    );
  }

  get isAvailable(): boolean {
    return this.stock.availableUnits > 0;
  }

  amountFor(quantity: number): Result<Money, DomainError> {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return err(new InvalidQuantityError(quantity));
    }
    return this.price.multiply(quantity);
  }
}
