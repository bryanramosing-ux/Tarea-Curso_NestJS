import { Ticket } from '../entities/ticket';
import { EventReference } from '../value-objects/event-reference';
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
  findIssuedByEvent(eventId: EventReference): Promise<Ticket[]>;
}
