import 'reflect-metadata';
import { config as loadDotEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions, resolveDatabaseSettings } from './database.config';
import { validateEnv } from './env.validation';

/**
 * DataSource del CLI de TypeORM (pnpm migration:run | migration:revert | migration:show).
 * Carga .env, aplica la MISMA validación y la MISMA configuración que la app.
 */
loadDotEnv();
const env = validateEnv(process.env);

export default new DataSource(buildDataSourceOptions(resolveDatabaseSettings((key) => env[key])));
