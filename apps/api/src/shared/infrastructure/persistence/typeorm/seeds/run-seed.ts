import 'reflect-metadata';

import { ProductOrmEntity } from '@/contexts/catalog/infrastructure/persistence/product.orm-entity';
import { StockItemOrmEntity } from '@/contexts/catalog/infrastructure/persistence/stock-item.orm-entity';

import dataSource from '../data-source';
import { PRODUCT_SEEDS } from './products.data';

const shouldResetStock = process.argv.includes('--reset-stock');

async function seed(): Promise<void> {
  await dataSource.initialize();

  try {
    await dataSource.transaction(async (manager) => {
      const products = manager.getRepository(ProductOrmEntity);
      const stockItems = manager.getRepository(StockItemOrmEntity);

      for (const item of PRODUCT_SEEDS) {
        const existing = await products.findOne({ where: { sku: item.sku } });

        const product = await products.save(
          products.create({
            ...existing,
            sku: item.sku,
            name: item.name,
            description: item.description,
            priceInCents: item.priceInCents,
            imageUrl: item.imageUrl,
            currency: 'COP',
          }),
        );

        const stock = await stockItems.findOne({ where: { productId: product.id } });

        if (!stock) {
          await stockItems.save(
            stockItems.create({
              productId: product.id,
              availableUnits: item.availableUnits,
              reservedUnits: 0,
            }),
          );
        } else if (shouldResetStock) {
          stock.availableUnits = item.availableUnits;
          stock.reservedUnits = 0;
          await stockItems.save(stock);
        }
      }
    });

    const suffix = shouldResetStock ? ' (stock restablecido)' : '';
    console.log(`Seed completado: ${PRODUCT_SEEDS.length} productos${suffix}.`);
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error('El seed falló:', error);
  process.exit(1);
});
