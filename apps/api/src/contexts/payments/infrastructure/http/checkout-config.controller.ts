import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';

import {
  type CheckoutConfig,
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '@/contexts/payments/domain/ports/payment-gateway.port';
import { map } from '@/shared/domain/result';
import { type FeesConfig } from '@/shared/infrastructure/config/configuration';
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

  @ApiProperty({ example: 500000, description: 'Comisión base aplicada a toda orden, en centavos.' })
  baseFeeInCents: number;

  @ApiProperty({ example: 1000000, description: 'Costo de envío, en centavos.' })
  deliveryFeeInCents: number;
}

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutConfigController {
  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly config: ConfigService,
  ) {}

  @Get('config')
  @ApiOperation({
    summary: 'Datos públicos que el SPA necesita para el checkout',
    description:
      'Evita que el frontend conozca la URL o las llaves privadas de la pasarela, y le da las comisiones para mostrar el resumen antes de crear la transacción.',
  })
  @ApiOkResponse({ type: CheckoutConfigResponse })
  async getConfig(): Promise<CheckoutConfigResponse> {
    const fees = this.config.getOrThrow<FeesConfig>('fees');
    const result = await this.gateway.getCheckoutConfig();

    return unwrapOrThrow(
      map(result, (gatewayConfig: CheckoutConfig) => ({
        ...gatewayConfig,
        baseFeeInCents: fees.baseFeeCents,
        deliveryFeeInCents: fees.deliveryFeeCents,
      })),
    );
  }
}
