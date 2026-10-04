import { Event, EventPrimitives } from '../../../domain/entities/event';
import { EventConcurrentModificationError, EventSlotTakenError } from '../../../domain/errors/event.errors';
import { EventRepository, EventSearchCriteria } from '../../../domain/ports/event.repository';
import { EventId } from '../../../domain/value-objects/event-id';
import { EventStart } from '../../../domain/value-objects/event-start';
import { Venue } from '../../../domain/value-objects/venue';

/**
 * Adaptador en memoria del puerto EventRepository (pruebas unitarias).
 * Cumple el mismo contrato que el real: copias de primitivas, reconstrucción
 * con fromPrimitives, unicidad recinto + hora y bloqueo optimista.
 */
export class InMemoryEventRepository implements EventRepository {
  private readonly rows = new Map<string, EventPrimitives>();

  async save(event: Event): Promise<void> {
    const primitives = event.toPrimitives();
    const stored = this.rows.get(primitives.id);
    if ((stored?.version ?? 0) !== primitives.version) {
      throw new EventConcurrentModificationError(primitives.id);
    }
    const slotOwner = [...this.rows.values()].find(
      (row) =>
        row.venue.toLowerCase() === primitives.venue.toLowerCase() &&
        row.startsAt.getTime() === primitives.startsAt.getTime(),
    );
    if (slotOwner && slotOwner.id !== primitives.id) {
      throw new EventSlotTakenError(primitives.venue, primitives.startsAt);
    }
    this.rows.set(primitives.id, { ...primitives, version: primitives.version + 1 });
    event.markAsPersisted();
  }

  async findById(id: EventId): Promise<Event | null> {
    const row = this.rows.get(id.value);
    return row ? Event.fromPrimitives({ ...row }) : null;
  }

  async findByVenueAndStart(venue: Venue, startsAt: EventStart): Promise<Event | null> {
    const row = [...this.rows.values()].find(
      (candidate) =>
        candidate.venue.toLowerCase() === venue.key && candidate.startsAt.getTime() === startsAt.value.getTime(),
    );
    return row ? Event.fromPrimitives({ ...row }) : null;
  }

  async search(criteria: EventSearchCriteria): Promise<Event[]> {
    return [...this.rows.values()]
      .filter((row) => !criteria.status || row.status === criteria.status.value)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id))
      .map((row) => Event.fromPrimitives({ ...row }));
  }
}
