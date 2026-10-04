import { DomainEvent } from '../../../shared/domain/domain-event';

/** Se cerró la venta de entradas de un evento (p. ej. porque se canceló). */
export class SalesClosed implements DomainEvent {
  readonly eventName = 'ticketing.sales_closed';

  constructor(
    public readonly eventId: string,
    public readonly occurredOn: Date,
  ) {}
}
