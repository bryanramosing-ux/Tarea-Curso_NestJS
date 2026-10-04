import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contexto Venta de entradas.
 * ticket_allocations (cupo de cada evento):
 *  - pk_ticket_allocations: un cupo por evento; si dos primeras compras lo crean a
 *    la vez, la clave primaria rechaza una (el adaptador lo traduce a conflicto).
 *  - ck_ticket_allocations_sold: RN-009, sold entre 0 y el aforo. Aunque falle el
 *    código, la base nunca permite sobrevender.
 * tickets:
 *  - uq_tickets_code_hash: RN-012, cada código (su hash) es único.
 *  - ck_tickets_used_at: RN-013, solo una entrada USED tiene fecha de uso.
 *  - FKs al evento: la venta solo existe para eventos del catálogo. RESTRICT: los
 *    eventos se cancelan, no se borran.
 */
export class CreateTicketingTables1759536060000 implements MigrationInterface {
  name = 'CreateTicketingTables1759536060000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ticket_allocations" (
        "event_id"    uuid         NOT NULL,
        "capacity"    integer      NOT NULL,
        "sold"        integer      NOT NULL,
        "price_cents" integer      NOT NULL,
        "currency"    varchar(3)   NOT NULL,
        "starts_at"   timestamptz  NOT NULL,
        "status"      varchar(16)  NOT NULL,
        "created_at"  timestamptz  NOT NULL,
        "updated_at"  timestamptz  NOT NULL,
        "version"     integer      NOT NULL DEFAULT 1,
        CONSTRAINT "pk_ticket_allocations" PRIMARY KEY ("event_id"),
        CONSTRAINT "fk_ticket_allocations_event" FOREIGN KEY ("event_id")
          REFERENCES "events" ("id") ON DELETE RESTRICT,
        CONSTRAINT "ck_ticket_allocations_capacity" CHECK ("capacity" >= 1),
        CONSTRAINT "ck_ticket_allocations_sold" CHECK ("sold" >= 0 AND "sold" <= "capacity"),
        CONSTRAINT "ck_ticket_allocations_price" CHECK ("price_cents" >= 0),
        CONSTRAINT "ck_ticket_allocations_status" CHECK ("status" IN ('OPEN', 'CLOSED')),
        CONSTRAINT "ck_ticket_allocations_version" CHECK ("version" >= 1)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "tickets" (
        "id"           uuid          NOT NULL,
        "event_id"     uuid          NOT NULL,
        "holder_name"  varchar(80)   NOT NULL,
        "holder_email" varchar(254)  NOT NULL,
        "code_hash"    varchar(64)   NOT NULL,
        "price_cents"  integer       NOT NULL,
        "currency"     varchar(3)    NOT NULL,
        "status"       varchar(16)   NOT NULL,
        "purchased_at" timestamptz   NOT NULL,
        "used_at"      timestamptz   NULL,
        "updated_at"   timestamptz   NOT NULL,
        "version"      integer       NOT NULL DEFAULT 1,
        CONSTRAINT "pk_tickets" PRIMARY KEY ("id"),
        CONSTRAINT "uq_tickets_code_hash" UNIQUE ("code_hash"),
        CONSTRAINT "fk_tickets_event" FOREIGN KEY ("event_id")
          REFERENCES "events" ("id") ON DELETE RESTRICT,
        CONSTRAINT "ck_tickets_status" CHECK ("status" IN ('ISSUED', 'USED', 'REFUNDED')),
        CONSTRAINT "ck_tickets_used_at" CHECK (("status" = 'USED') = ("used_at" IS NOT NULL)),
        CONSTRAINT "ck_tickets_price" CHECK ("price_cents" >= 0),
        CONSTRAINT "ck_tickets_version" CHECK ("version" >= 1)
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_tickets_event_status" ON "tickets" ("event_id", "status")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_tickets_event_status"`);
    await queryRunner.query(`DROP TABLE "tickets"`);
    await queryRunner.query(`DROP TABLE "ticket_allocations"`);
  }
}
