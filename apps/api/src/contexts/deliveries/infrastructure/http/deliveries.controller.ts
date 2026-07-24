import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import { GetDeliveryUseCase } from '@/contexts/deliveries/application/get-delivery.use-case';
import { type Delivery, DeliveryStatus } from '@/contexts/deliveries/domain/delivery';
import { map } from '@/shared/domain/result';
import { unwrapOrThrow } from '@/shared/infrastructure/http/domain-error.mapper';

import { UpdateDeliveryStatusUseCase } from '../../application/update-delivery-status.use-case';

export class UpdateDeliveryStatusRequest {
  @ApiProperty({ enum: [DeliveryStatus.SHIPPED, DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED] })
  @IsIn([DeliveryStatus.SHIPPED, DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED])
  status: DeliveryStatus;
}

export class DeliveryResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  transactionId: string;

  @ApiProperty({ format: 'uuid' })
  customerId: string;

  @ApiProperty({ enum: DeliveryStatus })
  status: DeliveryStatus;

  @ApiProperty({ example: 'Ana Pérez' })
  recipientName: string;

  @ApiProperty({ example: 'Calle 123 # 45-67' })
  addressLine1: string;

  @ApiPropertyOptional({ nullable: true })
  addressLine2: string | null;

  @ApiProperty({ example: 'Medellín' })
  city: string;

  @ApiProperty({ example: 'Antioquia' })
  region: string;

  @ApiProperty({ example: 'CO' })
  country: string;

  @ApiProperty({ example: 1000000 })
  deliveryFeeInCents: number;

  @ApiPropertyOptional({ nullable: true })
  trackingCode: string | null;

  @ApiPropertyOptional({ nullable: true })
  assignedAt: string | null;

  static fromDomain(this: void, delivery: Delivery): DeliveryResponse {
    const { address } = delivery;

    return {
      id: delivery.id,
      transactionId: delivery.transactionId,
      customerId: delivery.customerId,
      status: delivery.status,
      recipientName: address.recipientName,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      region: address.region,
      country: address.country,
      deliveryFeeInCents: delivery.fee.amountInCents,
      trackingCode: delivery.trackingCode,
      assignedAt: delivery.assignedAt?.toISOString() ?? null,
    };
  }
}

@ApiTags('deliveries')
@Controller('deliveries')
export class DeliveriesController {
  constructor(
    private readonly getDelivery: GetDeliveryUseCase,
    private readonly updateStatus: UpdateDeliveryStatusUseCase,
  ) {}

  @Get(':transactionId')
  @ApiOperation({ summary: 'Consulta la entrega asociada a una transacción' })
  @ApiOkResponse({ type: DeliveryResponse })
  @ApiNotFoundResponse({ description: 'No existe una entrega para esa transacción.' })
  async findOne(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
  ): Promise<DeliveryResponse> {
    const result = await this.getDelivery.execute(transactionId);

    return unwrapOrThrow(map(result, DeliveryResponse.fromDomain));
  }

  @Patch(':transactionId/status')
  @ApiOperation({ summary: 'Avanza el estado logístico de una entrega' })
  @ApiOkResponse({ type: DeliveryResponse })
  @ApiNotFoundResponse({ description: 'No existe una entrega para esa transacción.' })
  @ApiConflictResponse({ description: 'La transición de estado no está permitida.' })
  async update(
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() body: UpdateDeliveryStatusRequest,
  ): Promise<DeliveryResponse> {
    const result = await this.updateStatus.execute(transactionId, body.status);

    return unwrapOrThrow(map(result, DeliveryResponse.fromDomain));
  }
}
