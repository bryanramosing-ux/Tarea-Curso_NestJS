import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions, resolveDatabaseSettings } from './config/database.config';
import { EnvironmentVariables, validateEnv } from './config/env.validation';
import { CatalogModule } from './catalog/catalog.module';
import { ApiKeyGuard } from './shared/infrastructure/http/auth/api-key.guard';
import { buildThrottlerOptions } from './shared/infrastructure/http/throttling/throttler.config';
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
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        buildThrottlerOptions({
          THROTTLE_TTL_SECONDS: config.get('THROTTLE_TTL_SECONDS', { infer: true }),
          THROTTLE_LIMIT: config.get('THROTTLE_LIMIT', { infer: true }),
          THROTTLE_SENSITIVE_LIMIT: config.get('THROTTLE_SENSITIVE_LIMIT', { infer: true }),
        }),
    }),
    CqrsModule.forRoot(),
    SharedModule,
    CatalogModule,
    TicketingModule,
  ],
  providers: [
    // Orden importante: primero el límite de peticiones (también frena a quien
    // prueba claves de API a fuerza bruta) y después la autenticación.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
  ],
})
export class AppModule {}
