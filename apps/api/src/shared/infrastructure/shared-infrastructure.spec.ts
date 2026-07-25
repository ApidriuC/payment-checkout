import { HttpStatus } from '@nestjs/common';

import { DomainError, DomainErrorKind, UnexpectedError } from '@/shared/domain/domain-error';
import { err, ok } from '@/shared/domain/result';

import { CryptoIdGenerator } from './adapters/crypto-id-generator.adapter';
import { SystemClock } from './adapters/system-clock.adapter';
import {
  appConfig,
  databaseConfig,
  feesConfig,
  paymentGatewayConfig,
} from './config/configuration';
import { EnvironmentVariables, NodeEnv, validateEnvironment } from './config/env.validation';
import { httpStatusFor, toHttpException, unwrapOrThrow } from './http/domain-error.mapper';
import { HealthController } from './http/health.controller';

class TestError extends DomainError {
  readonly code = 'TEST_ERROR';

  constructor(readonly kind: DomainErrorKind) {
    super('mensaje de prueba', { field: 'value' });
  }
}

describe('CryptoIdGenerator', () => {
  it('generates a UUID', () => {
    expect(new CryptoIdGenerator().generate()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('never repeats an id', () => {
    const generator = new CryptoIdGenerator();
    const ids = new Set(Array.from({ length: 200 }, () => generator.generate()));

    expect(ids.size).toBe(200);
  });
});

describe('SystemClock', () => {
  it('returns the current time', () => {
    const before = Date.now();

    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
  });
});

describe('domain error mapper', () => {
  it.each([
    [DomainErrorKind.Validation, HttpStatus.BAD_REQUEST],
    [DomainErrorKind.NotFound, HttpStatus.NOT_FOUND],
    [DomainErrorKind.Conflict, HttpStatus.CONFLICT],
    [DomainErrorKind.Unavailable, HttpStatus.BAD_GATEWAY],
    [DomainErrorKind.Unexpected, HttpStatus.INTERNAL_SERVER_ERROR],
  ])('maps %s to %s', (kind, status) => {
    expect(httpStatusFor(new TestError(kind))).toBe(status);
  });

  it('builds an exception carrying the code and details', () => {
    const exception = toHttpException(new TestError(DomainErrorKind.Validation));

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual({
      code: 'TEST_ERROR',
      message: 'mensaje de prueba',
      details: { field: 'value' },
    });
  });

  it('omits the details key when the error carries none', () => {
    const exception = toHttpException(new UnexpectedError('algo pasó'));

    expect(exception.getResponse()).not.toHaveProperty('details');
  });

  it('returns the value of a successful result', () => {
    expect(unwrapOrThrow(ok('valor'))).toBe('valor');
  });

  it('throws for a failed result', () => {
    expect(() => unwrapOrThrow(err(new TestError(DomainErrorKind.NotFound)))).toThrow(
      'mensaje de prueba',
    );
  });
});

describe('HealthController', () => {
  it('delegates the readiness check to the database indicator', async () => {
    const pingCheck = jest.fn().mockResolvedValue({ database: { status: 'up' } });
    const check = jest.fn().mockImplementation(async (indicators: (() => Promise<unknown>)[]) => {
      await Promise.all(indicators.map((indicator) => indicator()));
      return { status: 'ok', info: { database: { status: 'up' } } };
    });

    const controller = new HealthController(
      { check } as never,
      { pingCheck } as never,
    );

    const result = await controller.check();

    expect(pingCheck).toHaveBeenCalledWith('database', { timeout: 3000 });
    expect(result.status).toBe('ok');
  });
});

describe('validateEnvironment', () => {
  const validEnv = {
    NODE_ENV: 'test',
    PORT: '4000',
    CORS_ORIGINS: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://user:pass@host/db',
    DATABASE_SSL: 'true',
    DATABASE_LOGGING: 'false',
    PAYMENT_GATEWAY_BASE_URL: 'https://gateway.test/v1',
    PAYMENT_GATEWAY_PUBLIC_KEY: 'pub',
    PAYMENT_GATEWAY_PRIVATE_KEY: 'prv',
    PAYMENT_GATEWAY_INTEGRITY_KEY: 'integrity',
    PAYMENT_GATEWAY_EVENTS_KEY: 'events',
    PAYMENT_GATEWAY_TIMEOUT_MS: '15000',
    BASE_FEE_CENTS: '500000',
    DELIVERY_FEE_CENTS: '1000000',
  };

  it('coerces numeric variables', () => {
    const parsed = validateEnvironment(validEnv);

    expect(parsed.PORT).toBe(4000);
    expect(parsed.BASE_FEE_CENTS).toBe(500000);
    expect(parsed.PAYMENT_GATEWAY_TIMEOUT_MS).toBe(15000);
  });

  it.each([
    ['true', true],
    ['1', true],
    ['yes', true],
    ['false', false],
    ['0', false],
    ['no', false],
  ])('coerces the boolean %p', (raw, expected) => {
    expect(validateEnvironment({ ...validEnv, DATABASE_SSL: raw }).DATABASE_SSL).toBe(expected);
  });

  it('applies defaults for optional variables', () => {
    const parsed = validateEnvironment({
      DATABASE_URL: validEnv.DATABASE_URL,
      PAYMENT_GATEWAY_BASE_URL: validEnv.PAYMENT_GATEWAY_BASE_URL,
      PAYMENT_GATEWAY_PUBLIC_KEY: 'pub',
      PAYMENT_GATEWAY_PRIVATE_KEY: 'prv',
      PAYMENT_GATEWAY_INTEGRITY_KEY: 'integrity',
      PAYMENT_GATEWAY_EVENTS_KEY: 'events',
    });

    expect(parsed.NODE_ENV).toBe(NodeEnv.Development);
    expect(parsed.PORT).toBe(3000);
    expect(parsed.DELIVERY_FEE_CENTS).toBe(1000000);
  });

  it('rejects a missing database url', () => {
    const withoutUrl: Record<string, string> = { ...validEnv };
    delete withoutUrl.DATABASE_URL;

    expect(() => validateEnvironment(withoutUrl)).toThrow(/DATABASE_URL/);
  });

  it('rejects a port outside the valid range', () => {
    expect(() => validateEnvironment({ ...validEnv, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejects a malformed gateway url', () => {
    expect(() => validateEnvironment({ ...validEnv, PAYMENT_GATEWAY_BASE_URL: 'no-es-url' })).toThrow(
      /PAYMENT_GATEWAY_BASE_URL/,
    );
  });

  it('rejects an unknown environment name', () => {
    expect(() => validateEnvironment({ ...validEnv, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('rejects a negative fee', () => {
    expect(() => validateEnvironment({ ...validEnv, BASE_FEE_CENTS: '-1' })).toThrow(
      /BASE_FEE_CENTS/,
    );
  });

  it('exposes the declared variables as a typed instance', () => {
    expect(validateEnvironment(validEnv)).toBeInstanceOf(EnvironmentVariables);
  });
});

describe('configuration namespaces', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('splits and trims the CORS origins', () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.CORS_ORIGINS = 'http://a.test , http://b.test ,';

    expect(appConfig()).toEqual({
      nodeEnv: 'test',
      port: 3000,
      corsOrigins: ['http://a.test', 'http://b.test'],
    });
  });

  it('reads the database settings', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host/db';
    process.env.DATABASE_SSL = 'true';
    process.env.DATABASE_LOGGING = 'false';

    expect(databaseConfig()).toEqual({
      url: 'postgresql://user:pass@host/db',
      ssl: true,
      logging: false,
    });
  });

  it('strips trailing slashes from the gateway base url', () => {
    process.env.PAYMENT_GATEWAY_BASE_URL = 'https://gateway.test/v1//';
    process.env.PAYMENT_GATEWAY_PUBLIC_KEY = 'pub';
    process.env.PAYMENT_GATEWAY_PRIVATE_KEY = 'prv';
    process.env.PAYMENT_GATEWAY_INTEGRITY_KEY = 'integrity';
    process.env.PAYMENT_GATEWAY_EVENTS_KEY = 'events';
    process.env.PAYMENT_GATEWAY_TIMEOUT_MS = '15000';

    expect(paymentGatewayConfig().baseUrl).toBe('https://gateway.test/v1');
  });

  it('reads the order fees', () => {
    process.env.BASE_FEE_CENTS = '500000';
    process.env.DELIVERY_FEE_CENTS = '1000000';

    expect(feesConfig()).toEqual({ baseFeeCents: 500000, deliveryFeeCents: 1000000 });
  });
});
