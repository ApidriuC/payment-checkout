import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { TransactionOrmEntity, TransactionStatus } from './transaction.orm-entity';

export enum TransactionEventSource {
  API = 'API',
  GATEWAY_WEBHOOK = 'GATEWAY_WEBHOOK',
}

@Entity('transaction_events')
export class TransactionEventOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'transaction_id' })
  transactionId: string;

  @ManyToOne(() => TransactionOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction_id' })
  transaction?: TransactionOrmEntity;

  @Column({ type: 'varchar', length: 20, name: 'from_status' })
  fromStatus: TransactionStatus;

  @Column({ type: 'varchar', length: 20, name: 'to_status' })
  toStatus: TransactionStatus;

  @Column({ type: 'enum', enum: TransactionEventSource })
  source: TransactionEventSource;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
