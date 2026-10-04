import { EventCatalog } from '../../domain/ports/event-catalog.port';
import { EventReference } from '../../domain/value-objects/event-reference';
import { SaleableEvent } from '../../domain/value-objects/saleable-event';

/** Adaptador en memoria del puerto EventCatalog (pruebas unitarias). */
export class InMemoryEventCatalog implements EventCatalog {
  private readonly events = new Map<string, SaleableEvent>();

  add(event: SaleableEvent): void {
    this.events.set(event.id.value, event);
  }

  async findEvent(id: EventReference): Promise<SaleableEvent | null> {
    return this.events.get(id.value) ?? null;
  }
}
