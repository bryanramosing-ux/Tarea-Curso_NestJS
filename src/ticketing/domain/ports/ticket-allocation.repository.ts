import { TicketAllocation } from '../entities/ticket-allocation';
import { EventReference } from '../value-objects/event-reference';

export const TICKET_ALLOCATION_REPOSITORY = Symbol('TICKET_ALLOCATION_REPOSITORY');

/**
 * Puerto de persistencia del cupo de entradas de cada evento.
 * `findByEvent` devuelve `null` si aún no se ha vendido nada para ese evento.
 * `save` aplica bloqueo optimista: si otra operación cambió (o creó) el cupo
 * desde que se leyó, lanza SalesConcurrentModificationError en lugar de
 * sobrescribirlo.
 */
export interface TicketAllocationRepository {
  save(allocation: TicketAllocation): Promise<void>;
  findByEvent(eventId: EventReference): Promise<TicketAllocation | null>;
  /** Hasta `limit` cupos con la venta ABIERTA, ordenados por evento, después de `after` (paginación por clave). */
  findOpen(limit: number, after?: EventReference): Promise<TicketAllocation[]>;
}
