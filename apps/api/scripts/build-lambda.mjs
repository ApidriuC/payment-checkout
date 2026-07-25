import { build } from 'esbuild';
import { rm } from 'node:fs/promises';

// NestJS lazily requires these only when the corresponding feature is enabled.
// They are not installed, so esbuild must not try to resolve them.
const OPTIONAL_NEST_DEPS = [
  '@nestjs/microservices',
  '@nestjs/microservices/microservices-module',
  '@nestjs/websockets',
  '@nestjs/websockets/socket-module',
  '@nestjs/platform-socket.io',
  '@fastify/static',
  '@fastify/view',
  'class-transformer/storage',
  'cache-manager',
  'ioredis',
];

// Terminus probes for every ORM it can health-check; we only use TypeORM.
const UNUSED_TERMINUS_INDICATORS = [
  '@nestjs/sequelize',
  '@nestjs/sequelize/dist/common/sequelize.utils',
  '@nestjs/mongoose',
  '@mikro-orm/core',
  '@nestjs/axios',
  '@grpc/grpc-js',
  '@grpc/proto-loader',
  'check-disk-space',
];

// TypeORM ships drivers for every database it supports; we only use PostgreSQL.
const UNUSED_TYPEORM_DRIVERS = [
  'mysql',
  'mysql2',
  'better-sqlite3',
  'sqlite3',
  'sql.js',
  'mssql',
  'oracledb',
  'mongodb',
  'redis',
  'ioredis',
  '@sap/hana-client',
  'hdb-pool',
  'pg-native',
  'pg-query-stream',
  'typeorm-aurora-data-api-driver',
  '@google-cloud/spanner',
  'react-native-sqlite-storage',
];

await rm('dist-lambda', { recursive: true, force: true });

// Entry point is the tsc output, not the TypeScript source: esbuild does not
// implement emitDecoratorMetadata, and without it NestJS cannot resolve the
// constructor dependencies it infers from types. tsc already baked that metadata
// into dist/, so esbuild only has to bundle plain JavaScript.
const result = await build({
  entryPoints: ['dist/lambda.js'],
  outfile: 'dist-lambda/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  external: [...OPTIONAL_NEST_DEPS, ...UNUSED_TERMINUS_INDICATORS, ...UNUSED_TYPEORM_DRIVERS],
  logLevel: 'info',
  metafile: true,
});

const bytes = Object.values(result.metafile.outputs).reduce(
  (total, output) => total + output.bytes,
  0,
);

console.log(`Bundle listo: dist-lambda/index.js (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
