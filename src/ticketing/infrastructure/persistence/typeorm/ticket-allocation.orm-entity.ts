import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Modelo de persistencia del cupo de entradas de un evento (NO es la entidad
 * de dominio). La restricción sold <= capacity y la FK al evento las define
 * la migración.
 */
@Entity({ name: 'ticket_allocations' })
export class TicketAllocationOrmEntity {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ type: 'integer' })
  capacity: number;

  @Column({ type: 'integer' })
  sold: number;

  @Column({ name: 'price_cents', type: 'integer' })
  priceCents: number;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

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
