import { ApiProperty } from '@nestjs/swagger';

import { type Product } from '@/contexts/catalog/domain/product';
import { type Stock } from '@/contexts/catalog/domain/stock';

export class StockResponse {
  @ApiProperty({ example: 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d' })
  productId: string;

  @ApiProperty({ example: 12, description: 'Unidades que un cliente puede comprar ahora.' })
  availableUnits: number;

  @ApiProperty({ example: 2, description: 'Unidades retenidas por compras en curso.' })
  reservedUnits: number;

  static fromDomain(this: void, stock: Stock): StockResponse {
    return {
      productId: stock.productId,
      availableUnits: stock.availableUnits,
      reservedUnits: stock.reservedUnits,
    };
  }
}

export class ProductResponse {
  @ApiProperty({ example: 'a3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: 'AUD-ORBIT-01' })
  sku: string;

  @ApiProperty({ example: 'Audífonos Orbit Pro' })
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ example: 45990000, description: 'Precio unitario en centavos.' })
  priceInCents: number;

  @ApiProperty({ example: 'COP' })
  currency: string;

  @ApiProperty({ example: '/images/products/orbit-headphones.svg' })
  imageUrl: string;

  @ApiProperty({ example: 12 })
  availableUnits: number;

  static fromDomain(this: void, product: Product): ProductResponse {
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      priceInCents: product.price.amountInCents,
      currency: product.price.currency,
      imageUrl: product.imageUrl,
      availableUnits: product.stock.availableUnits,
    };
  }
}
