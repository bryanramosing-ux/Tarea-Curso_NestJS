import { DomainEvent } from '../../../shared/domain/domain-event';

/** Un evento fue cancelado: ya no se celebrará. */
export class EventCancelled implements DomainEvent {
  readonly eventName = 'catalog.event_cancelled';

  constructor(
    public readonly eventId: string,
    public readonly occurredOn: Date,
  ) {}
}
