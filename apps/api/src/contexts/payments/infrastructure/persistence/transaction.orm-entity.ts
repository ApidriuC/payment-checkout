import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ProductOrmEntity } from '@/contexts/catalog/infrastructure/persistence/product.orm-entity';
import { CustomerOrmEntity } from '@/contexts/customers/infrastructure/persistence/customer.orm-entity';
import { bigintTransformer } from '@/shared/infrastructure/persistence/typeorm/transformers/bigint.transformer';

export enum TransactionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  VOIDED = 'VOIDED',
  ERROR = 'ERROR',
}

export enum CardBrand {
  VISA = 'VISA',
  MASTERCARD = 'MASTERCARD',
  UNKNOWN = 'UNKNOWN',
}

@Entity('transactions')
export class TransactionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  reference: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => CustomerOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer?: CustomerOrmEntity;

  @Column({ type: 'uuid', name: 'product_id' })
  productId: string;

  @ManyToOne(() => ProductOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product?: ProductOrmEntity;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'bigint', name: 'product_amount_in_cents', transformer: bigintTransformer })
  productAmountInCents: number;

  @Column({ type: 'bigint', name: 'base_fee_in_cents', transformer: bigintTransformer })
  baseFeeInCents: number;

  @Column({ type: 'bigint', name: 'delivery_fee_in_cents', transformer: bigintTransformer })
  deliveryFeeInCents: number;

  @Column({ type: 'bigint', name: 'total_amount_in_cents', transformer: bigintTransformer })
  totalAmountInCents: number;

  @Column({ type: 'char', length: 3, default: 'COP' })
  currency: string;

  @Index()
  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Column({ type: 'varchar', length: 64, name: 'gateway_transaction_id', nullable: true })
  gatewayTransactionId: string | null;

  @Column({ type: 'varchar', length: 32, name: 'gateway_status', nullable: true })
  gatewayStatus: string | null;

  @Column({ type: 'text', name: 'failure_reason', nullable: true })
  failureReason: string | null;

  @Column({ type: 'enum', enum: CardBrand, name: 'card_brand', nullable: true })
  cardBrand: CardBrand | null;

  @Column({ type: 'char', length: 4, name: 'card_last_four', nullable: true })
  cardLastFour: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt: Date | null;
}
