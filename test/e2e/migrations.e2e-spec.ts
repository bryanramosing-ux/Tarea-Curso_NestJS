import { DataSource } from 'typeorm';
import { createTestApp } from './support/test-app';
import { INestApplication } from '@nestjs/common';

/**
 * Comprueba que el esquema lo crean (y lo deshacen) las migraciones reales:
 * restricciones e índices presentes, y down() reversible.
 */
describe('Migrations (e2e, PostgreSQL real)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  const tables = async (): Promise<string[]> =>
    (
      await dataSource.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'tasks') ORDER BY table_name`,
      )
    ).map((row: { table_name: string }) => row.table_name);

  it('all migrations are applied and nothing is pending', async () => {
    expect(await dataSource.showMigrations()).toBe(false);
    expect(await tables()).toEqual(['tasks', 'users']);
  });

  it('creates the constraints and indexes the domain relies on', async () => {
    const constraints = (
      await dataSource.query(
        `SELECT conname FROM pg_constraint WHERE conrelid IN ('users'::regclass, 'tasks'::regclass) ORDER BY conname`,
      )
    ).map((row: { conname: string }) => row.conname);
    expect(constraints).toEqual(
      expect.arrayContaining([
        'pk_users',
        'uq_users_email',
        'ck_users_status',
        'pk_tasks',
        'fk_tasks_assignee',
        'ck_tasks_status',
        'ck_tasks_priority',
        'ck_tasks_assignee_required',
        'ck_users_version',
        'ck_tasks_version',
      ]),
    );

    const indexes = (
      await dataSource.query(`SELECT indexname FROM pg_indexes WHERE tablename IN ('users', 'tasks')`)
    ).map((row: { indexname: string }) => row.indexname);
    expect(indexes).toEqual(expect.arrayContaining(['uq_users_email', 'ix_tasks_status_created_at', 'ix_tasks_assignee_id']));
  });

  it('down() reverts every migration and up() re-applies them', async () => {
    await dataSource.undoLastMigration({ transaction: 'each' });
    const versionColumns = await dataSource.query(
      `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'version'`,
    );
    expect(versionColumns).toEqual([]);
    expect(await tables()).toEqual(['tasks', 'users']);
    await dataSource.undoLastMigration({ transaction: 'each' });
    expect(await tables()).toEqual(['users']);
    await dataSource.undoLastMigration({ transaction: 'each' });
    expect(await tables()).toEqual([]);

    const applied = await dataSource.runMigrations({ transaction: 'each' });
    expect(applied.map((migration) => migration.name)).toEqual([
      'CreateUsersTable1759363200000',
      'CreateTasksTable1759363260000',
      'AddOptimisticLockingVersion1759413600000',
    ]);
    expect(await tables()).toEqual(['tasks', 'users']);
  });
});
