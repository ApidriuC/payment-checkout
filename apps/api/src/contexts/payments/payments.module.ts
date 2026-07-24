import { Module } from '@nestjs/common';

import { CatalogModule } from '@/contexts/catalog/catalog.module';
import { CustomersModule } from '@/contexts/customers/customers.module';
import { DeliveriesModule } from '@/contexts/deliveries/deliveries.module';

import { CreateTransactionUseCase } from './application/create-transaction.use-case';
import { GetTransactionUseCase } from './application/get-transaction.use-case';
import { HandleGatewayEventUseCase } from './application/handle-gateway-event.use-case';
import { ProcessPaymentUseCase } from './application/process-payment.use-case';
import { SettleTransactionService } from './application/settle-transaction.service';
import { PAYMENT_GATEWAY } from './domain/ports/payment-gateway.port';
import { REFERENCE_GENERATOR } from './domain/ports/reference-generator.port';
import { TRANSACTION_REPOSITORY } from './domain/ports/transaction.repository';
import { PrefixedReferenceGenerator } from './infrastructure/adapters/prefixed-reference-generator.adapter';
import { HttpPaymentGateway } from './infrastructure/gateway/http-payment-gateway.adapter';
import { CheckoutConfigController } from './infrastructure/http/checkout-config.controller';
import { PaymentEventsController } from './infrastructure/http/payment-events.controller';
import { TransactionsController } from './infrastructure/http/transactions.controller';
import { TypeOrmTransactionRepository } from './infrastructure/persistence/typeorm-transaction.repository';

@Module({
  imports: [CatalogModule, CustomersModule, DeliveriesModule],
  controllers: [TransactionsController, CheckoutConfigController, PaymentEventsController],
  providers: [
    CreateTransactionUseCase,
    ProcessPaymentUseCase,
    GetTransactionUseCase,
    HandleGatewayEventUseCase,
    SettleTransactionService,
    { provide: TRANSACTION_REPOSITORY, useClass: TypeOrmTransactionRepository },
    { provide: PAYMENT_GATEWAY, useClass: HttpPaymentGateway },
    { provide: REFERENCE_GENERATOR, useClass: PrefixedReferenceGenerator },
  ],
})
export class PaymentsModule {}
