import { DomainEvent } from '../../../shared/domain/domain-event';

/** El titular entró al evento con esta entrada. */
export class TicketCheckedIn implements DomainEvent {
  readonly eventName = 'ticketing.ticket_checked_in';

  constructor(
    public readonly ticketId: string,
    public readonly eventId: string,
    public readonly occurredOn: Date,
  ) {}
}
