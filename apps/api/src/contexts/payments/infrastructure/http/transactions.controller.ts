import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CreateTransactionUseCase } from '@/contexts/payments/application/create-transaction.use-case';
import { GetTransactionUseCase } from '@/contexts/payments/application/get-transaction.use-case';
import { ProcessPaymentUseCase } from '@/contexts/payments/application/process-payment.use-case';
import { map } from '@/shared/domain/result';
import { unwrapOrThrow } from '@/shared/infrastructure/http/domain-error.mapper';

import { CreateTransactionRequest } from './dto/create-transaction.request';
import { ProcessPaymentRequest } from './dto/process-payment.request';
import { TransactionResponse } from './dto/transaction.response';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransaction: CreateTransactionUseCase,
    private readonly processPayment: ProcessPaymentUseCase,
    private readonly getTransaction: GetTransactionUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crea una transacción PENDING y reserva el stock',
    description:
      'Devuelve el número de transacción y el desglose de importes. Las unidades quedan reservadas hasta que el pago se resuelva.',
  })
  @ApiCreatedResponse({ type: TransactionResponse })
  @ApiBadRequestResponse({ description: 'Datos del cliente o de la entrega inválidos.' })
  @ApiNotFoundResponse({ description: 'El producto no existe.' })
  @ApiConflictResponse({ description: 'No hay unidades suficientes disponibles.' })
  async create(@Body() body: CreateTransactionRequest): Promise<TransactionResponse> {
    const result = await this.createTransaction.execute({
      productId: body.productId,
      quantity: body.quantity,
      customer: {
        email: body.customer.email,
        fullName: body.customer.fullName,
        phoneNumber: body.customer.phoneNumber,
        legalIdType: body.customer.legalIdType ?? null,
        legalIdNumber: body.customer.legalIdNumber ?? null,
      },
      delivery: body.delivery,
    });

    return unwrapOrThrow(map(result, TransactionResponse.fromDomain));
  }

  @Post(':reference/payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecuta el pago de una transacción pendiente',
    description:
      'Envía el token de tarjeta a la pasarela y liquida el resultado: actualiza la transacción, el stock y la entrega.',
  })
  @ApiOkResponse({ type: TransactionResponse })
  @ApiNotFoundResponse({ description: 'La transacción no existe.' })
  @ApiConflictResponse({ description: 'La transacción ya tiene un resultado final.' })
  async pay(
    @Param('reference') reference: string,
    @Body() body: ProcessPaymentRequest,
  ): Promise<TransactionResponse> {
    const result = await this.processPayment.execute({
      reference,
      cardToken: body.cardToken,
      acceptanceToken: body.acceptanceToken,
      personalDataAuthToken: body.personalDataAuthToken ?? null,
      installments: body.installments,
      cardBrand: body.cardBrand,
      cardLastFour: body.cardLastFour,
    });

    return unwrapOrThrow(map(result, TransactionResponse.fromDomain));
  }

  @Get(':reference')
  @ApiOperation({
    summary: 'Consulta el estado de una transacción',
    description: 'Permite al cliente recuperar el resultado tras un refresco de la página.',
  })
  @ApiOkResponse({ type: TransactionResponse })
  @ApiNotFoundResponse({ description: 'La transacción no existe.' })
  async findOne(@Param('reference') reference: string): Promise<TransactionResponse> {
    const result = await this.getTransaction.execute(reference);

    return unwrapOrThrow(map(result, TransactionResponse.fromDomain));
  }
}
