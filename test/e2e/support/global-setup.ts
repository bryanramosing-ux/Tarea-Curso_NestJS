import 'reflect-metadata';
import { config as loadDotEnv } from 'dotenv';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions, DatabaseSettings, resolveDatabaseSettings } from '../../../src/config/database.config';
import { validateEnv } from '../../../src/config/env.validation';

const SAFE_IDENTIFIER = /^[A-Za-z0-9_]+$/;

/** Crea la base de pruebas (DB_NAME_TEST) en el mismo servidor si aún no existe. */
async function ensureTestDatabase(settings: DatabaseSettings, maintenanceDatabase: string): Promise<void> {
  if (!SAFE_IDENTIFIER.test(settings.database)) {
    throw new Error('DB_NAME_TEST may only contain letters, digits and underscores');
  }
  const client = new Client({
    host: settings.host,
    port: settings.port,
    user: settings.username,
    password: settings.password,
    database: maintenanceDatabase,
  });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [settings.database]);
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${settings.database}"`);
    }
  } finally {
    await client.end();
  }
}

/**
 * Se ejecuta una vez antes de las pruebas e2e:
 *  1. fuerza NODE_ENV=test (la app usará DB_NAME_TEST, nunca la base de desarrollo);
 *  2. crea la base de pruebas si no existe;
 *  3. la vacía por completo y aplica las MIGRACIONES REALES desde cero.
 */
export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = 'test';
  loadDotEnv();
  const env = validateEnv(process.env);
  const settings = resolveDatabaseSettings((key) => env[key]);

  if (settings.database === env.DB_NAME) {
    throw new Error('DB_NAME_TEST must be different from DB_NAME: e2e tests wipe their database');
  }

  await ensureTestDatabase(settings, env.DB_NAME);

  const dataSource = new DataSource(buildDataSourceOptions(settings));
  await dataSource.initialize();
  try {
    await dataSource.dropDatabase();
    await dataSource.runMigrations({ transaction: 'each' });
  } finally {
    await dataSource.destroy();
  }
}
