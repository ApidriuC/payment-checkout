import { registerAs } from '@nestjs/config';

import { type NodeEnv } from './env.validation';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  corsOrigins: string[];
}

export interface DatabaseConfig {
  url: string;
  ssl: boolean;
  logging: boolean;
}

export interface PaymentGatewayConfig {
  baseUrl: string;
  publicKey: string;
  privateKey: string;
  integrityKey: string;
  eventsKey: string;
  timeoutMs: number;
}

export interface FeesConfig {
  baseFeeCents: number;
  deliveryFeeCents: number;
}

export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    nodeEnv: process.env.NODE_ENV as NodeEnv,
    port: Number(process.env.PORT),
    corsOrigins: String(process.env.CORS_ORIGINS)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  }),
);

export const databaseConfig = registerAs(
  'database',
  (): DatabaseConfig => ({
    url: String(process.env.DATABASE_URL),
    ssl: process.env.DATABASE_SSL === 'true',
    logging: process.env.DATABASE_LOGGING === 'true',
  }),
);

export const paymentGatewayConfig = registerAs(
  'paymentGateway',
  (): PaymentGatewayConfig => ({
    baseUrl: String(process.env.PAYMENT_GATEWAY_BASE_URL).replace(/\/+$/, ''),
    publicKey: String(process.env.PAYMENT_GATEWAY_PUBLIC_KEY),
    privateKey: String(process.env.PAYMENT_GATEWAY_PRIVATE_KEY),
    integrityKey: String(process.env.PAYMENT_GATEWAY_INTEGRITY_KEY),
    eventsKey: String(process.env.PAYMENT_GATEWAY_EVENTS_KEY),
    timeoutMs: Number(process.env.PAYMENT_GATEWAY_TIMEOUT_MS),
  }),
);

export const feesConfig = registerAs(
  'fees',
  (): FeesConfig => ({
    baseFeeCents: Number(process.env.BASE_FEE_CENTS),
    deliveryFeeCents: Number(process.env.DELIVERY_FEE_CENTS),
  }),
);

export const configurations = [appConfig, databaseConfig, paymentGatewayConfig, feesConfig];
