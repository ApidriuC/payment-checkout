import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { GetProductStockUseCase } from '@/contexts/catalog/application/get-product-stock.use-case';
import { GetProductUseCase } from '@/contexts/catalog/application/get-product.use-case';
import { ListProductsUseCase } from '@/contexts/catalog/application/list-products.use-case';
import { map } from '@/shared/domain/result';
import { unwrapOrThrow } from '@/shared/infrastructure/http/domain-error.mapper';

import { ProductResponse, StockResponse } from './dto/product.response';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly listProducts: ListProductsUseCase,
    private readonly getProduct: GetProductUseCase,
    private readonly getProductStock: GetProductStockUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista los productos del catálogo con su stock disponible' })
  @ApiOkResponse({ type: [ProductResponse] })
  async findAll(): Promise<ProductResponse[]> {
    const result = await this.listProducts.execute();

    return unwrapOrThrow(map(result, (products) => products.map(ProductResponse.fromDomain)));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene el detalle de un producto' })
  @ApiOkResponse({ type: ProductResponse })
  @ApiNotFoundResponse({ description: 'El producto no existe.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProductResponse> {
    const result = await this.getProduct.execute(id);

    return unwrapOrThrow(map(result, ProductResponse.fromDomain));
  }

  @Get(':id/stock')
  @ApiOperation({ summary: 'Consulta el stock actual de un producto' })
  @ApiOkResponse({ type: StockResponse })
  @ApiNotFoundResponse({ description: 'El producto no tiene stock registrado.' })
  async findStock(@Param('id', ParseUUIDPipe) id: string): Promise<StockResponse> {
    const result = await this.getProductStock.execute(id);

    return unwrapOrThrow(map(result, StockResponse.fromDomain));
  }
}
