import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bloqueo optimista para users y tasks.
 * Corrige "actualizaciones perdidas": dos operaciones que leen el mismo
 * agregado y lo guardan después ya no se sobrescriben en silencio; la segunda
 * recibe *_CONCURRENT_MODIFICATION (409). Las filas existentes empiezan en 1.
 */
export class AddOptimisticLockingVersion1759413600000 implements MigrationInterface {
  name = 'AddOptimisticLockingVersion1759413600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "version" integer NOT NULL DEFAULT 1`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "ck_users_version" CHECK ("version" >= 1)`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD "version" integer NOT NULL DEFAULT 1`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "ck_tasks_version" CHECK ("version" >= 1)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "ck_tasks_version"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "version"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "ck_users_version"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "version"`);
  }
}
