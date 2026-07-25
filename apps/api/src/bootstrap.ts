import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';

import { type AppConfig } from '@/shared/infrastructure/config/configuration';
import { AllExceptionsFilter } from '@/shared/infrastructure/http/filters/all-exceptions.filter';

export const API_PREFIX = 'api';
export const SWAGGER_PATH = 'docs';

export function configureApp(app: INestApplication): void {
  const { corsOrigins } = app.get(ConfigService).getOrThrow<AppConfig>('app');

  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], frameAncestors: ["'none'"] } },
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(compression());

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Idempotency-Key'],
    maxAge: 86_400,
  });

  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}

/**
 * Registers both the Swagger UI at /docs and the raw spec at /docs-json.
 *
 * In production only /docs-json is reachable: the Lambda ships as a single bundled
 * file with no static assets beside it, so CloudFront serves the UI from the CDN
 * and routes just the spec here. Locally the UI works as usual.
 */
export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Payment Checkout API')
      .setDescription('Products, customers, deliveries and card payment transactions.')
      .setVersion('1.0')
      .build(),
  );

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
