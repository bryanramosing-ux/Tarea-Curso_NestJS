import { DataSourceOptions } from 'typeorm';
import { MIGRATIONS } from '../database/migrations';
import { ORM_ENTITIES } from '../database/orm-entities';
import { EnvironmentVariables } from './env.validation';

export interface DatabaseSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export type EnvReader = <K extends keyof EnvironmentVariables>(key: K) => EnvironmentVariables[K];

/** Con NODE_ENV=test se usa una base aislada (DB_NAME_TEST) para no tocar datos de desarrollo. */
export function resolveDatabaseSettings(read: EnvReader): DatabaseSettings {
  const isTest = read('NODE_ENV') === 'test';
  return {
    host: read('DB_HOST'),
    port: read('DB_PORT'),
    username: read('DB_USER'),
    password: read('DB_PASSWORD'),
    database: isTest ? (read('DB_NAME_TEST') as string) : read('DB_NAME'),
  };
}

/**
 * ÚNICA definición de la conexión, compartida por la aplicación
 * (TypeOrmModule) y por el CLI de migraciones (typeorm.data-source.ts).
 * synchronize=false SIEMPRE: el esquema lo definen las migraciones.
 * logging=false para que ningún parámetro de consulta (p. ej. hashes)
 * llegue a los logs.
 */
export function buildDataSourceOptions(settings: DatabaseSettings): DataSourceOptions {
  return {
    type: 'postgres',
    host: settings.host,
    port: settings.port,
    username: settings.username,
    password: settings.password,
    database: settings.database,
    entities: ORM_ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'migrations',
    synchronize: false,
    migrationsRun: false,
    logging: false,
  };
}
