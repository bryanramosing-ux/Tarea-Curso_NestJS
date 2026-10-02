import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Modelo de persistencia (NO es la entidad de dominio).
 * La estructura real de la tabla la definen las migraciones
 * (src/database/migrations); este mapeo solo describe columnas.
 */
@Entity({ name: 'users' })
export class UserOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 16 })
  status: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /** Bloqueo optimista: se incrementa en cada guardado. */
  @Column({ type: 'integer' })
  version: number;
}
