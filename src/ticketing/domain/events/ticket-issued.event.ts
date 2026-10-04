import { DomainEvent } from '../../../shared/domain/domain-event';

/** Se emitió una entrada. No transporta el código secreto ni datos personales. */
export class TicketIssued implements DomainEvent {
  readonly eventName = 'ticketing.ticket_issued';

  constructor(
    public readonly ticketId: string,
    public readonly eventId: string,
    public readonly occurredOn: Date,
  ) {}
}
