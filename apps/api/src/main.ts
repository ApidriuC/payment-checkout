import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { type AppConfig } from '@/shared/infrastructure/config/configuration';

import { AppModule } from './app.module';
import { configureApp, setupSwagger, SWAGGER_PATH } from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const { port } = app.get(ConfigService).getOrThrow<AppConfig>('app');

  configureApp(app);
  setupSwagger(app);
  app.enableShutdownHooks();

  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on port ${port} — docs at /${SWAGGER_PATH}`);
}

void bootstrap();
