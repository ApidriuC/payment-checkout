import { Global, Module } from '@nestjs/common';

import { CLOCK } from './application/ports/clock.port';
import { ID_GENERATOR } from './application/ports/id-generator.port';
import { UNIT_OF_WORK } from './application/ports/unit-of-work.port';
import { CryptoIdGenerator } from './infrastructure/adapters/crypto-id-generator.adapter';
import { SystemClock } from './infrastructure/adapters/system-clock.adapter';
import { TypeOrmUnitOfWork } from './infrastructure/persistence/typeorm/typeorm-unit-of-work';

@Global()
@Module({
  providers: [
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    { provide: CLOCK, useClass: SystemClock },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
  ],
  exports: [ID_GENERATOR, CLOCK, UNIT_OF_WORK],
})
export class SharedModule {}
