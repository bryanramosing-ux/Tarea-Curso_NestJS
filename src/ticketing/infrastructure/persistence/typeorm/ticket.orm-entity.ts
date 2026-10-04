import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Modelo de persistencia de Ticket (NO es la entidad de dominio).
 * Guarda el HASH del código, nunca el código en claro.
 */
@Entity({ name: 'tickets' })
export class TicketOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ name: 'holder_name', type: 'varchar', length: 80 })
  holderName: string;

  @Column({ name: 'holder_email', type: 'varchar', length: 254 })
  holderEmail: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 64 })
  codeHash: string;

  @Column({ name: 'price_cents', type: 'integer' })
  priceCents: number;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 16 })
  status: string;

  @Column({ name: 'purchased_at', type: 'timestamptz' })
  purchasedAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /** Bloqueo optimista: se incrementa en cada guardado. */
  @Column({ type: 'integer' })
  version: number;
}
