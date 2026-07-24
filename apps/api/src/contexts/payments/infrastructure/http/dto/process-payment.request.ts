import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class ProcessPaymentRequest {
  @ApiProperty({
    example: 'tok_test_1234_abcdefghijklmnop',
    description: 'Token de un solo uso emitido por la pasarela. El número de tarjeta nunca llega a esta API.',
  })
  @IsString()
  @Length(10, 128)
  cardToken: string;

  @ApiProperty({ description: 'Token de aceptación de términos y condiciones.' })
  @IsString()
  @Length(10, 4096)
  acceptanceToken: string;

  @ApiPropertyOptional({ description: 'Token de autorización de tratamiento de datos personales.' })
  @IsOptional()
  @IsString()
  @Length(10, 4096)
  personalDataAuthToken?: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 36 })
  @IsInt()
  @Min(1)
  @Max(36)
  installments: number;

  @ApiProperty({ enum: ['VISA', 'MASTERCARD', 'UNKNOWN'] })
  @IsIn(['VISA', 'MASTERCARD', 'UNKNOWN'])
  cardBrand: string;

  @ApiProperty({ example: '4242', description: 'Últimos cuatro dígitos de la tarjeta.' })
  @Matches(/^\d{4}$/)
  cardLastFour: string;
}
