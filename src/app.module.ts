import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions, resolveDatabaseSettings } from './config/database.config';
import { EnvironmentVariables, validateEnv } from './config/env.validation';
import { CatalogModule } from './catalog/catalog.module';
import { SharedModule } from './shared/shared.module';
import { TicketingModule } from './ticketing/ticketing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        buildDataSourceOptions(resolveDatabaseSettings((key) => config.get(key, { infer: true }))),
    }),
    CqrsModule.forRoot(),
    SharedModule,
    CatalogModule,
    TicketingModule,
  ],
})
export class AppModule {}
