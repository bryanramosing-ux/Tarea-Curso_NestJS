import { DomainEvent } from '../../domain/domain-event';
import { DomainEventPublisher } from '../../domain/ports/domain-event-publisher.port';

/** Adaptador en memoria del publicador: registra los eventos (pruebas unitarias). */
export class InMemoryDomainEventPublisher implements DomainEventPublisher {
  readonly published: DomainEvent[] = [];

  async publishAll(events: DomainEvent[]): Promise<void> {
    this.published.push(...events);
  }
}
