import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { bigintTransformer } from '@/shared/infrastructure/persistence/typeorm/transformers/bigint.transformer';

import { StockItemOrmEntity } from './stock-item.orm-entity';

@Entity('products')
export class ProductOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'bigint', name: 'price_in_cents', transformer: bigintTransformer })
  priceInCents: number;

  @Column({ type: 'char', length: 3, default: 'COP' })
  currency: string;

  @Column({ type: 'text', name: 'image_url' })
  imageUrl: string;

  @OneToOne(() => StockItemOrmEntity, (stock) => stock.product)
  stock?: StockItemOrmEntity;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
