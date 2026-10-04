import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Modelo de persistencia de Event (NO es la entidad de dominio).
 * La estructura real de la tabla (restricciones, índices) la definen las migraciones.
 */
@Entity({ name: 'events' })
export class EventOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 120 })
  venue: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'integer' })
  capacity: number;

  @Column({ name: 'price_cents', type: 'integer' })
  priceCents: number;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

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
