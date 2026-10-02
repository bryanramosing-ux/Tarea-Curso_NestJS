import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contexto Tasks.
 *  - fk_tasks_assignee: el responsable debe existir (RN-011). RESTRICT: los
 *    usuarios no se borran, se desactivan.
 *  - ck_tasks_assignee_required: RN-010, fuera de TODO siempre hay responsable.
 *  - ck_tasks_status / ck_tasks_priority: valores del dominio (RN-009, RN-014).
 *  - Índices para los filtros del tablero (estado y responsable).
 */
export class CreateTasksTable1759363260000 implements MigrationInterface {
  name = 'CreateTasksTable1759363260000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id"          uuid          NOT NULL,
        "title"       varchar(120)  NOT NULL,
        "description" text          NOT NULL DEFAULT '',
        "status"      varchar(16)   NOT NULL,
        "priority"    varchar(8)    NOT NULL,
        "assignee_id" uuid          NULL,
        "created_at"  timestamptz   NOT NULL,
        "updated_at"  timestamptz   NOT NULL,
        CONSTRAINT "pk_tasks" PRIMARY KEY ("id"),
        CONSTRAINT "fk_tasks_assignee" FOREIGN KEY ("assignee_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "ck_tasks_status" CHECK ("status" IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')),
        CONSTRAINT "ck_tasks_priority" CHECK ("priority" IN ('LOW', 'MEDIUM', 'HIGH')),
        CONSTRAINT "ck_tasks_assignee_required" CHECK ("status" = 'TODO' OR "assignee_id" IS NOT NULL)
      )
    `);
    await queryRunner.query(`CREATE INDEX "ix_tasks_status_created_at" ON "tasks" ("status", "created_at")`);
    await queryRunner.query(`CREATE INDEX "ix_tasks_assignee_id" ON "tasks" ("assignee_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_tasks_assignee_id"`);
    await queryRunner.query(`DROP INDEX "ix_tasks_status_created_at"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
  }
}
