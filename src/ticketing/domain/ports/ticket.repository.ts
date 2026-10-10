import { Ticket } from '../entities/ticket';
import { EventReference } from '../value-objects/event-reference';
import { HolderEmail } from '../value-objects/holder-email';
import { TicketCodeHash } from '../value-objects/ticket-code-hash';
import { TicketId } from '../value-objects/ticket-id';

export const TICKET_REPOSITORY = Symbol('TICKET_REPOSITORY');

/**
 * Puerto de persistencia del agregado Ticket.
 * Las búsquedas devuelven `null` si no hay resultado; `save` aplica bloqueo
 * optimista (TicketConcurrentModificationError).
 */
export interface TicketRepository {
  save(ticket: Ticket): Promise<void>;
  findById(id: TicketId): Promise<Ticket | null>;
  findByCodeHash(codeHash: TicketCodeHash): Promise<Ticket | null>;
  /** Hasta `limit` entradas ISSUED del evento, las más antiguas primero (procesado por lotes). */
  findIssuedByEvent(eventId: EventReference, limit: number): Promise<Ticket[]>;
  /** Entradas activas (ISSUED o USED; no las reembolsadas) de un titular para un evento (RN-008). */
  countActiveByEventAndHolder(eventId: EventReference, holderEmail: HolderEmail): Promise<number>;
}
