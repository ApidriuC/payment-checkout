import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return value;
};

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  PORT = 3000;

  @IsString()
  CORS_ORIGINS = 'http://localhost:5173';

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsBoolean()
  @Transform(toBoolean)
  DATABASE_SSL = true;

  @IsBoolean()
  @Transform(toBoolean)
  DATABASE_LOGGING = false;

  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] })
  PAYMENT_GATEWAY_BASE_URL: string;

  @IsString()
  @IsNotEmpty()
  PAYMENT_GATEWAY_PUBLIC_KEY: string;

  @IsString()
  @IsNotEmpty()
  PAYMENT_GATEWAY_PRIVATE_KEY: string;

  @IsString()
  @IsNotEmpty()
  PAYMENT_GATEWAY_INTEGRITY_KEY: string;

  @IsString()
  @IsNotEmpty()
  PAYMENT_GATEWAY_EVENTS_KEY: string;

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  PAYMENT_GATEWAY_TIMEOUT_MS = 15000;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  BASE_FEE_CENTS = 500000;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  DELIVERY_FEE_CENTS = 1000000;
}

export function validateEnvironment(raw: Record<string, unknown>): EnvironmentVariables {
  const parsed = plainToInstance(EnvironmentVariables, raw, { exposeDefaultValues: true });

  const errors = validateSync(parsed, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => `  - ${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return parsed;
}
