import 'reflect-metadata';

import serverlessExpress from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import { type Context, type Handler } from 'aws-lambda';
import { type Express } from 'express';

import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './bootstrap';

let cachedHandler: Handler | undefined;

// Nest is bootstrapped once per container and reused across invocations, so only
// the first request after a cold start pays for building the module graph and
// opening the database pool.
async function createHandler(): Promise<Handler> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  configureApp(app);
  setupSwagger(app);

  await app.init();

  const expressApp = app.getHttpAdapter().getInstance() as Express;

  return serverlessExpress({ app: expressApp }) as Handler;
}

export const handler: Handler = async (event: unknown, context: Context, callback) => {
  cachedHandler ??= await createHandler();

  return cachedHandler(event, context, callback) as unknown;
};
