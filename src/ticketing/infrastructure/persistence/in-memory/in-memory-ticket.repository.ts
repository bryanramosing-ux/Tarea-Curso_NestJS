import { Ticket, TicketPrimitives } from '../../../domain/entities/ticket';
import { TicketConcurrentModificationError } from '../../../domain/errors/ticketing.errors';
import { TicketRepository } from '../../../domain/ports/ticket.repository';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { TicketCodeHash } from '../../../domain/value-objects/ticket-code-hash';
import { TicketId } from '../../../domain/value-objects/ticket-id';
import { TicketStatusValue } from '../../../domain/value-objects/ticket-status';

/** Adaptador en memoria del puerto TicketRepository (pruebas unitarias), con bloqueo optimista. */
export class InMemoryTicketRepository implements TicketRepository {
  private readonly rows = new Map<string, TicketPrimitives>();

  async save(ticket: Ticket): Promise<void> {
    const primitives = ticket.toPrimitives();
    const stored = this.rows.get(primitives.id);
    if ((stored?.version ?? 0) !== primitives.version) {
      throw new TicketConcurrentModificationError(primitives.id);
    }
    this.rows.set(primitives.id, { ...primitives, version: primitives.version + 1 });
    ticket.markAsPersisted();
  }

  async findById(id: TicketId): Promise<Ticket | null> {
    const row = this.rows.get(id.value);
    return row ? Ticket.fromPrimitives({ ...row }) : null;
  }

  async findByCodeHash(codeHash: TicketCodeHash): Promise<Ticket | null> {
    const row = [...this.rows.values()].find((candidate) => candidate.codeHash === codeHash.value);
    return row ? Ticket.fromPrimitives({ ...row }) : null;
  }

  async findIssuedByEvent(eventId: EventReference): Promise<Ticket[]> {
    return [...this.rows.values()]
      .filter((row) => row.eventId === eventId.value && row.status === TicketStatusValue.ISSUED)
      .sort((a, b) => a.purchasedAt.getTime() - b.purchasedAt.getTime() || a.id.localeCompare(b.id))
      .map((row) => Ticket.fromPrimitives({ ...row }));
  }

  /** Utilidad de pruebas: inspeccionar lo persistido. */
  all(): TicketPrimitives[] {
    return [...this.rows.values()].map((row) => ({ ...row }));
  }
}
