import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Modelo de persistencia de Task (NO es la entidad de dominio).
 * La FK hacia users(id) existe solo en la migración: a nivel de código
 * los contextos no comparten modelos ORM.
 */
@Entity({ name: 'tasks' })
export class TaskOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 16 })
  status: string;

  @Column({ type: 'varchar', length: 8 })
  priority: string;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /** Bloqueo optimista: se incrementa en cada guardado. */
  @Column({ type: 'integer' })
  version: number;
}
