import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';

// TypeORM resolves its database driver through a runtime require that esbuild
// cannot follow, so the driver has to travel as a real package inside the zip
// instead of being inlined in the bundle.
const RUNTIME_DEPENDENCIES = ['pg'];

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

const excludedFromBundle = [...OPTIONAL_NEST_DEPS, ...UNUSED_TYPEORM_DRIVERS];

// An external that IS installed resolves fine here but blows up in Lambda, where
// node_modules does not ship. Catch that at build time instead of at runtime.
const require = createRequire(import.meta.url);
const wronglyExcluded = excludedFromBundle.filter((name) => {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
});

if (wronglyExcluded.length > 0) {
  console.error(
    `Estos paquetes están instalados y no pueden marcarse como externos, ` +
      `porque la Lambda se despliega sin node_modules:\n  ${wronglyExcluded.join('\n  ')}`,
  );
  process.exit(1);
}

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
  external: [...excludedFromBundle, ...RUNTIME_DEPENDENCIES],
  logLevel: 'info',
  metafile: true,
});

const { dependencies } = JSON.parse(await readFile('package.json', 'utf8'));
const runtimeSpecs = RUNTIME_DEPENDENCIES.map((name) => `${name}@${dependencies[name]}`);

execFileSync(
  'npm',
  ['install', ...runtimeSpecs, '--prefix', 'dist-lambda', '--no-save', '--no-package-lock', '--omit=dev'],
  { stdio: 'inherit', shell: true },
);

const bytes = Object.values(result.metafile.outputs).reduce(
  (total, output) => total + output.bytes,
  0,
);

console.log(
  `Bundle listo: dist-lambda/index.js (${(bytes / 1024 / 1024).toFixed(2)} MB) ` +
    `+ ${runtimeSpecs.join(', ')} en node_modules`,
);
