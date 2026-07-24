import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';

import { ProductOrmEntity } from '@/contexts/catalog/infrastructure/persistence/product.orm-entity';
import { StockItemOrmEntity } from '@/contexts/catalog/infrastructure/persistence/stock-item.orm-entity';
import { CustomerOrmEntity } from '@/contexts/customers/infrastructure/persistence/customer.orm-entity';
import { DeliveryOrmEntity } from '@/contexts/deliveries/infrastructure/persistence/delivery.orm-entity';
import { TransactionEventOrmEntity } from '@/contexts/payments/infrastructure/persistence/transaction-event.orm-entity';
import { TransactionOrmEntity } from '@/contexts/payments/infrastructure/persistence/transaction.orm-entity';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

export const ormEntities = [
  ProductOrmEntity,
  StockItemOrmEntity,
  CustomerOrmEntity,
  TransactionOrmEntity,
  TransactionEventOrmEntity,
  DeliveryOrmEntity,
];

export const buildDataSourceOptions = (env = process.env): DataSourceOptions => ({
  type: 'postgres',
  url: env.DATABASE_URL,
  ssl: env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: ormEntities,
  migrations: [`${__dirname}/migrations/*.{ts,js}`],
  migrationsTableName: 'schema_migrations',
  synchronize: false,
  logging: env.DATABASE_LOGGING === 'true',
});

export default new DataSource(buildDataSourceOptions());
