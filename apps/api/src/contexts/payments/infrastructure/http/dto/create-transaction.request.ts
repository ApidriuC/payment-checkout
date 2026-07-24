import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CustomerRequest {
  @ApiProperty({ example: 'ana.perez@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Ana Pérez' })
  @IsString()
  @Length(3, 160)
  fullName: string;

  @ApiProperty({ example: '+573001112233' })
  @IsString()
  @Length(7, 20)
  phoneNumber: string;

  @ApiPropertyOptional({ enum: ['CC', 'CE', 'NIT', 'PP'] })
  @IsOptional()
  @IsIn(['CC', 'CE', 'NIT', 'PP'])
  legalIdType?: string;

  @ApiPropertyOptional({ example: '1020304050' })
  @IsOptional()
  @IsString()
  @Length(5, 20)
  legalIdNumber?: string;
}

export class DeliveryRequest {
  @ApiProperty({ example: 'Ana Pérez' })
  @IsString()
  @Length(2, 160)
  recipientName: string;

  @ApiProperty({ example: '+573001112233' })
  @IsString()
  @Length(7, 20)
  recipientPhone: string;

  @ApiProperty({ example: 'Calle 123 # 45-67' })
  @IsString()
  @Length(2, 255)
  addressLine1: string;

  @ApiPropertyOptional({ example: 'Apto 302' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine2?: string;

  @ApiProperty({ example: 'Medellín' })
  @IsString()
  @Length(2, 120)
  city: string;

  @ApiProperty({ example: 'Antioquia' })
  @IsString()
  @Length(2, 120)
  region: string;

  @ApiPropertyOptional({ example: 'CO', default: 'CO' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({ example: '050001' })
  @IsOptional()
  @IsString()
  @Length(3, 20)
  postalCode?: string;
}

export class CreateTransactionRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;

  @ApiProperty({ type: CustomerRequest })
  @ValidateNested()
  @Type(() => CustomerRequest)
  @IsNotEmpty()
  customer: CustomerRequest;

  @ApiProperty({ type: DeliveryRequest })
  @ValidateNested()
  @Type(() => DeliveryRequest)
  @IsNotEmpty()
  delivery: DeliveryRequest;
}
