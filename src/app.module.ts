import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions, resolveDatabaseSettings } from './config/database.config';
import { EnvironmentVariables, validateEnv } from './config/env.validation';
import { SharedModule } from './shared/shared.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

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
    UsersModule,
    TasksModule,
  ],
})
export class AppModule {}
