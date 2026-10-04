import { DomainEvent } from '../../../shared/domain/domain-event';

/** Se vendieron entradas de un evento. */
export class TicketsSold implements DomainEvent {
  readonly eventName = 'ticketing.tickets_sold';

  constructor(
    public readonly eventId: string,
    public readonly quantity: number,
    public readonly remaining: number,
    public readonly occurredOn: Date,
  ) {}
}
