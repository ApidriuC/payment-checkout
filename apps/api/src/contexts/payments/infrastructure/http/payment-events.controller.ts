import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { HandleGatewayEventUseCase } from '@/contexts/payments/application/handle-gateway-event.use-case';
import { type GatewayEvent } from '@/contexts/payments/domain/ports/payment-gateway.port';
import { unwrapOrThrow } from '@/shared/infrastructure/http/domain-error.mapper';

@ApiTags('payment-events')
@Controller('payment-events')
export class PaymentEventsController {
  constructor(private readonly handleEvent: HandleGatewayEventUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recibe los eventos de la pasarela de pagos',
    description:
      'Verifica la firma del evento antes de aplicarlo. Los eventos repetidos o tardíos se descartan sin alterar la transacción.',
  })
  @ApiBody({ description: 'Evento firmado emitido por la pasarela.' })
  @ApiOkResponse({ description: 'Evento procesado o descartado por idempotencia.' })
  async receive(@Body() event: GatewayEvent): Promise<{ received: true }> {
    unwrapOrThrow(await this.handleEvent.execute(event));

    return { received: true };
  }
}
