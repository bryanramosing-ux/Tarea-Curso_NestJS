import { DomainEvent } from '../../../shared/domain/domain-event';

/** Se vendió la última entrada disponible de un evento. */
export class EventSoldOut implements DomainEvent {
  readonly eventName = 'ticketing.event_sold_out';

  constructor(
    public readonly eventId: string,
    public readonly occurredOn: Date,
  ) {}
}
