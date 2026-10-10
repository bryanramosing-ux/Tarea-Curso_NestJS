import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices para las consultas añadidas con RN-008 y la conciliación de RN-014:
 *  - ix_tickets_event_holder: contar las entradas de un titular en un evento
 *    (tope por titular, RN-008) sin recorrer todas las entradas del evento;
 *  - ix_ticket_allocations_open: índice PARCIAL solo con los cupos abiertos,
 *    que son los que revisa la conciliación de ventas.
 */
export class AddHolderAndOpenSalesIndexes1759536120000 implements MigrationInterface {
  name = 'AddHolderAndOpenSalesIndexes1759536120000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "ix_tickets_event_holder" ON "tickets" ("event_id", "holder_email")`);
    await queryRunner.query(
      `CREATE INDEX "ix_ticket_allocations_open" ON "ticket_allocations" ("event_id") WHERE "status" = 'OPEN'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_ticket_allocations_open"`);
    await queryRunner.query(`DROP INDEX "ix_tickets_event_holder"`);
  }
}
