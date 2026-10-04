import { TicketAllocation, TicketAllocationPrimitives } from '../../../domain/entities/ticket-allocation';
import { SalesConcurrentModificationError } from '../../../domain/errors/ticketing.errors';
import { TicketAllocationRepository } from '../../../domain/ports/ticket-allocation.repository';
import { EventReference } from '../../../domain/value-objects/event-reference';

/**
 * Adaptador en memoria del puerto TicketAllocationRepository (pruebas unitarias).
 * Emula el contrato del real: clave primaria por evento y bloqueo optimista.
 */
export class InMemoryTicketAllocationRepository implements TicketAllocationRepository {
  private readonly rows = new Map<string, TicketAllocationPrimitives>();

  async save(allocation: TicketAllocation): Promise<void> {
    const primitives = allocation.toPrimitives();
    const stored = this.rows.get(primitives.eventId);
    if ((stored?.version ?? 0) !== primitives.version) {
      throw new SalesConcurrentModificationError(primitives.eventId);
    }
    this.rows.set(primitives.eventId, { ...primitives, version: primitives.version + 1 });
    allocation.markAsPersisted();
  }

  async findByEvent(eventId: EventReference): Promise<TicketAllocation | null> {
    const row = this.rows.get(eventId.value);
    return row ? TicketAllocation.fromPrimitives({ ...row }) : null;
  }
}
