import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// Swagger UI is served from the CDN alongside the SPA instead of from the Lambda,
// which ships as a single bundled file with no static assets next to it.
const ASSETS = ['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js'];

const require = createRequire(import.meta.url);
const source = dirname(require.resolve('swagger-ui-dist/swagger-ui.css'));
const target = join('public', 'swagger');

await mkdir(target, { recursive: true });

for (const asset of ASSETS) {
  await copyFile(join(source, asset), join(target, asset));
}

console.log(`Assets de Swagger copiados a ${target}/ (${ASSETS.length} archivos).`);
