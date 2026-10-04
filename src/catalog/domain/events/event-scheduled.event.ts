import { DomainEvent } from '../../../shared/domain/domain-event';

/** Un evento quedó programado en el catálogo. */
export class EventScheduled implements DomainEvent {
  readonly eventName = 'catalog.event_scheduled';

  constructor(
    public readonly eventId: string,
    public readonly name: string,
    public readonly startsAt: Date,
    public readonly capacity: number,
    public readonly occurredOn: Date,
  ) {}
}
