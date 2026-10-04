import { Query } from '@nestjs/cqrs';
import { TicketView } from '../../views/ticket.view';

/** Caso de uso de lectura: consultar una entrada. */
export class GetTicketQuery extends Query<TicketView> {
  constructor(public readonly ticketId: string) {
    super();
  }
}
