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
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('events', 'ticket_allocations', 'tickets') ORDER BY table_name`,
      )
    ).map((row: { table_name: string }) => row.table_name);

  it('all migrations are applied and nothing is pending', async () => {
    expect(await dataSource.showMigrations()).toBe(false);
    expect(await tables()).toEqual(['events', 'ticket_allocations', 'tickets']);
  });

  it('creates the constraints and indexes the domain relies on', async () => {
    const constraints = (
      await dataSource.query(
        `SELECT conname FROM pg_constraint
         WHERE conrelid IN ('events'::regclass, 'ticket_allocations'::regclass, 'tickets'::regclass)`,
      )
    ).map((row: { conname: string }) => row.conname);
    expect(constraints).toEqual(
      expect.arrayContaining([
        'pk_events',
        'ck_events_capacity',
        'ck_events_price',
        'ck_events_currency',
        'ck_events_status',
        'ck_events_version',
        'pk_ticket_allocations',
        'fk_ticket_allocations_event',
        'ck_ticket_allocations_sold',
        'pk_tickets',
        'uq_tickets_code_hash',
        'fk_tickets_event',
        'ck_tickets_status',
        'ck_tickets_used_at',
      ]),
    );

    const indexes = (
      await dataSource.query(`SELECT indexname FROM pg_indexes WHERE tablename IN ('events', 'tickets')`)
    ).map((row: { indexname: string }) => row.indexname);
    expect(indexes).toEqual(
      expect.arrayContaining(['uq_events_venue_starts_at', 'ix_events_status_starts_at', 'ix_tickets_event_status']),
    );
  });

  it('down() reverts every migration and up() re-applies them', async () => {
    await dataSource.undoLastMigration({ transaction: 'each' });
    expect(await tables()).toEqual(['events']);
    await dataSource.undoLastMigration({ transaction: 'each' });
    expect(await tables()).toEqual([]);

    const applied = await dataSource.runMigrations({ transaction: 'each' });
    expect(applied.map((migration) => migration.name)).toEqual([
      'CreateEventsTable1759536000000',
      'CreateTicketingTables1759536060000',
    ]);
    expect(await tables()).toEqual(['events', 'ticket_allocations', 'tickets']);
  });
});
