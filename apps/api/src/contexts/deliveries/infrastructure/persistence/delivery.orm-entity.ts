import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CustomerOrmEntity } from '@/contexts/customers/infrastructure/persistence/customer.orm-entity';
import { DeliveryStatus } from '@/contexts/deliveries/domain/delivery';
import { TransactionOrmEntity } from '@/contexts/payments/infrastructure/persistence/transaction.orm-entity';
import { bigintTransformer } from '@/shared/infrastructure/persistence/typeorm/transformers/bigint.transformer';

@Entity('deliveries')
export class DeliveryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'transaction_id', unique: true })
  transactionId: string;

  @OneToOne(() => TransactionOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction_id' })
  transaction?: TransactionOrmEntity;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => CustomerOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer?: CustomerOrmEntity;

  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.PENDING })
  status: DeliveryStatus;

  @Column({ type: 'varchar', length: 160, name: 'recipient_name' })
  recipientName: string;

  @Column({ type: 'varchar', length: 20, name: 'recipient_phone' })
  recipientPhone: string;

  @Column({ type: 'varchar', length: 255, name: 'address_line_1' })
  addressLine1: string;

  @Column({ type: 'varchar', length: 255, name: 'address_line_2', nullable: true })
  addressLine2: string | null;

  @Column({ type: 'varchar', length: 120 })
  city: string;

  @Column({ type: 'varchar', length: 120 })
  region: string;

  @Column({ type: 'char', length: 2, default: 'CO' })
  country: string;

  @Column({ type: 'varchar', length: 20, name: 'postal_code', nullable: true })
  postalCode: string | null;

  @Column({ type: 'bigint', name: 'delivery_fee_in_cents', transformer: bigintTransformer })
  deliveryFeeInCents: number;

  @Column({ type: 'varchar', length: 64, name: 'tracking_code', nullable: true })
  trackingCode: string | null;

  @Column({ type: 'timestamptz', name: 'assigned_at', nullable: true })
  assignedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
