import { DomainEvent } from '../../../shared/domain/domain-event';

/** La entrada fue reembolsada y deja de ser válida. */
export class TicketRefunded implements DomainEvent {
  readonly eventName = 'ticketing.ticket_refunded';

  constructor(
    public readonly ticketId: string,
    public readonly eventId: string,
    public readonly amountCents: number,
    public readonly currency: string,
    public readonly occurredOn: Date,
  ) {}
}
