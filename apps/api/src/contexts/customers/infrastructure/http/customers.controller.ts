import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';

import { GetCustomerUseCase } from '@/contexts/customers/application/get-customer.use-case';
import { type Customer } from '@/contexts/customers/domain/customer';
import { map } from '@/shared/domain/result';
import { unwrapOrThrow } from '@/shared/infrastructure/http/domain-error.mapper';

export class CustomerResponse {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'ana.perez@example.com' })
  email: string;

  @ApiProperty({ example: 'Ana Pérez' })
  fullName: string;

  @ApiProperty({ example: '+573001112233' })
  phoneNumber: string;

  @ApiProperty({ example: 'CC', nullable: true })
  legalIdType: string | null;

  @ApiProperty({ example: '1020304050', nullable: true })
  legalId: string | null;

  static fromDomain(this: void, customer: Customer): CustomerResponse {
    return {
      id: customer.id,
      email: customer.email.value,
      fullName: customer.fullName.value,
      phoneNumber: customer.phoneNumber.value,
      legalIdType: customer.legalId?.type ?? null,
      legalId: customer.legalId?.number ?? null,
    };
  }
}

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly getCustomer: GetCustomerUseCase) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene los datos de un cliente' })
  @ApiOkResponse({ type: CustomerResponse })
  @ApiNotFoundResponse({ description: 'El cliente no existe.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CustomerResponse> {
    const result = await this.getCustomer.execute(id);

    return unwrapOrThrow(map(result, CustomerResponse.fromDomain));
  }
}
