import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';

import {
  type CheckoutConfig,
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '@/contexts/payments/domain/ports/payment-gateway.port';
import { map } from '@/shared/domain/result';
import { unwrapOrThrow } from '@/shared/infrastructure/http/domain-error.mapper';

export class CheckoutConfigResponse {
  @ApiProperty({ description: 'Llave pública para tokenizar la tarjeta desde el navegador.' })
  publicKey: string;

  @ApiProperty({ description: 'Endpoint de tokenización de tarjetas.' })
  tokenizationUrl: string;

  @ApiProperty()
  acceptanceToken: string;

  @ApiProperty({ nullable: true })
  personalDataAuthToken: string | null;

  @ApiProperty({ nullable: true })
  termsUrl: string | null;

  static fromDomain(this: void, config: CheckoutConfig): CheckoutConfigResponse {
    return { ...config };
  }
}

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutConfigController {
  constructor(@Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway) {}

  @Get('config')
  @ApiOperation({
    summary: 'Datos públicos que el SPA necesita para tokenizar una tarjeta',
    description:
      'Evita que el frontend tenga que conocer la URL ni las llaves de la pasarela. Solo expone datos públicos.',
  })
  @ApiOkResponse({ type: CheckoutConfigResponse })
  async getConfig(): Promise<CheckoutConfigResponse> {
    const result = await this.gateway.getCheckoutConfig();

    return unwrapOrThrow(map(result, CheckoutConfigResponse.fromDomain));
  }
}
