import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { type DatabaseConfig } from '@/shared/infrastructure/config/configuration';

import { ormEntities } from './typeorm/data-source';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const database = config.getOrThrow<DatabaseConfig>('database');

        return {
          type: 'postgres' as const,
          url: database.url,
          ssl: database.ssl ? { rejectUnauthorized: true } : false,
          entities: ormEntities,
          synchronize: false,
          logging: database.logging,
          retryAttempts: 3,
          retryDelay: 2000,
        };
      },
    }),
  ],
})
export class PersistenceModule {}
