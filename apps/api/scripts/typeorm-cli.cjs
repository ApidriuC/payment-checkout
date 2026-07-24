// The typeorm binary runs ts-node without tsconfig-paths, so the "@/" aliases
// used across the entities fail to resolve. Register it before handing over.
const path = require('node:path');

const typeormCli = path.join(path.dirname(require.resolve('typeorm')), 'cli.js');

require('ts-node/register');
require('tsconfig-paths/register');

require(typeormCli);
