import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contexto Catálogo.
 *  - uq_events_venue_starts_at: RN-006, un recinto no puede tener dos eventos a la
 *    misma hora. Índice ÚNICO sobre lower(venue) para que "Estadio" = "estadio";
 *    la base lo garantiza incluso ante dos programaciones simultáneas.
 *  - CHECKs: valores que el dominio admite (RN-004, RN-005), defensa en profundidad.
 *  - version: bloqueo optimista (ADR-011).
 */
export class CreateEventsTable1759536000000 implements MigrationInterface {
  name = 'CreateEventsTable1759536000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "events" (
        "id"          uuid          NOT NULL,
        "name"        varchar(120)  NOT NULL,
        "venue"       varchar(120)  NOT NULL,
        "starts_at"   timestamptz   NOT NULL,
        "capacity"    integer       NOT NULL,
        "price_cents" integer       NOT NULL,
        "currency"    varchar(3)    NOT NULL,
        "status"      varchar(16)   NOT NULL,
        "created_at"  timestamptz   NOT NULL,
        "updated_at"  timestamptz   NOT NULL,
        "version"     integer       NOT NULL DEFAULT 1,
        CONSTRAINT "pk_events" PRIMARY KEY ("id"),
        CONSTRAINT "ck_events_capacity" CHECK ("capacity" BETWEEN 1 AND 100000),
        CONSTRAINT "ck_events_price" CHECK ("price_cents" BETWEEN 0 AND 10000000),
        CONSTRAINT "ck_events_currency" CHECK ("currency" IN ('PEN', 'USD', 'EUR')),
        CONSTRAINT "ck_events_status" CHECK ("status" IN ('SCHEDULED', 'CANCELLED')),
        CONSTRAINT "ck_events_version" CHECK ("version" >= 1)
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_events_venue_starts_at" ON "events" (lower("venue"), "starts_at")`);
    await queryRunner.query(`CREATE INDEX "ix_events_status_starts_at" ON "events" ("status", "starts_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_events_status_starts_at"`);
    await queryRunner.query(`DROP INDEX "uq_events_venue_starts_at"`);
    await queryRunner.query(`DROP TABLE "events"`);
  }
}
