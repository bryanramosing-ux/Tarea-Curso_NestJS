import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contexto Users.
 *  - uq_users_email: RN-002 (email único), garantizado por la base incluso ante concurrencia.
 *  - ck_users_status: solo estados conocidos por el dominio.
 */
export class CreateUsersTable1759363200000 implements MigrationInterface {
  name = 'CreateUsersTable1759363200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            uuid          NOT NULL,
        "name"          varchar(80)   NOT NULL,
        "email"         varchar(254)  NOT NULL,
        "password_hash" varchar(255)  NOT NULL,
        "status"        varchar(16)   NOT NULL,
        "created_at"    timestamptz   NOT NULL,
        "updated_at"    timestamptz   NOT NULL,
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_email" UNIQUE ("email"),
        CONSTRAINT "ck_users_status" CHECK ("status" IN ('ACTIVE', 'INACTIVE'))
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
