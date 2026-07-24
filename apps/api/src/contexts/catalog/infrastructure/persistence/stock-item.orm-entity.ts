import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

import { ProductOrmEntity } from './product.orm-entity';

@Entity('stock_items')
export class StockItemOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'product_id', unique: true })
  productId: string;

  @OneToOne(() => ProductOrmEntity, (product) => product.stock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product?: ProductOrmEntity;

  @Column({ type: 'int', name: 'available_units' })
  availableUnits: number;

  @Column({ type: 'int', name: 'reserved_units', default: 0 })
  reservedUnits: number;

  @VersionColumn()
  version: number;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
