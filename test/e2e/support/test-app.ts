import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { configureApp } from '../../../src/app.setup';

export interface TestApp {
  app: INestApplication;
  dataSource: DataSource;
}

/** Arranca la aplicación REAL (AppModule + mismo pipe y filtro que main.ts) contra la base de pruebas. */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication({ logger: ['error', 'warn'] }));
  await app.init();
  return { app, dataSource: app.get(DataSource) };
}

/** Deja las tablas vacías entre pruebas (el esquema lo crearon las migraciones en global-setup). */
export async function resetDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.query('TRUNCATE TABLE "tasks", "users" CASCADE');
}

/** Espera a que se cumpla una condición producida por un manejador de eventos asíncrono. */
export async function eventually<T>(probe: () => Promise<T>, accept: (value: T) => boolean, timeoutMs = 3000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = await probe();
  while (!accept(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    last = await probe();
  }
  return last;
}
