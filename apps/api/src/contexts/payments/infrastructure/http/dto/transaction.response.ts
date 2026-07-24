import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { type PaymentTransaction } from '@/contexts/payments/domain/payment-transaction';
import { TransactionStatus } from '@/contexts/payments/domain/transaction-status';

export class AmountsResponse {
  @ApiProperty({ example: 45990000 })
  productAmountInCents: number;

  @ApiProperty({ example: 500000 })
  baseFeeInCents: number;

  @ApiProperty({ example: 1000000 })
  deliveryFeeInCents: number;

  @ApiProperty({ example: 47490000 })
  totalInCents: number;

  @ApiProperty({ example: 'COP' })
  currency: string;
}

export class TransactionResponse {
  @ApiProperty({ example: 'TX-M3K8Q2-ABCDEFGHJK', description: 'Número de transacción.' })
  reference: string;

  @ApiProperty({ enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ format: 'uuid' })
  customerId: string;

  @ApiProperty({ example: 1 })
  quantity: number;

  @ApiProperty({ type: AmountsResponse })
  amounts: AmountsResponse;

  @ApiPropertyOptional({ example: 'VISA', nullable: true })
  cardBrand: string | null;

  @ApiPropertyOptional({ example: '4242', nullable: true })
  cardLastFour: string | null;

  @ApiPropertyOptional({ nullable: true })
  failureReason: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiPropertyOptional({ nullable: true })
  completedAt: string | null;

  static fromDomain(this: void, transaction: PaymentTransaction): TransactionResponse {
    const { amounts } = transaction;

    return {
      reference: transaction.reference,
      status: transaction.status,
      productId: transaction.productId,
      customerId: transaction.customerId,
      quantity: transaction.quantity,
      amounts: {
        productAmountInCents: amounts.productAmount.amountInCents,
        baseFeeInCents: amounts.baseFee.amountInCents,
        deliveryFeeInCents: amounts.deliveryFee.amountInCents,
        totalInCents: amounts.total.amountInCents,
        currency: amounts.currency,
      },
      cardBrand: transaction.card?.brand ?? null,
      cardLastFour: transaction.card?.lastFour ?? null,
      failureReason: transaction.failureReason,
      createdAt: transaction.createdAt.toISOString(),
      completedAt: transaction.completedAt?.toISOString() ?? null,
    };
  }
}
