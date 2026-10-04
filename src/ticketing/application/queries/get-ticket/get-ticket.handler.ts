import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TicketNotFoundError } from '../../../domain/errors/ticketing.errors';
import { TICKET_REPOSITORY, TicketRepository } from '../../../domain/ports/ticket.repository';
import { TicketId } from '../../../domain/value-objects/ticket-id';
import { TicketView, toTicketView } from '../../views/ticket.view';
import { GetTicketQuery } from './get-ticket.query';

@QueryHandler(GetTicketQuery)
export class GetTicketHandler implements IQueryHandler<GetTicketQuery> {
  constructor(@Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository) {}

  async execute(query: GetTicketQuery): Promise<TicketView> {
    const id = TicketId.create(query.ticketId);
    const ticket = await this.tickets.findById(id);
    if (!ticket) {
      throw new TicketNotFoundError(`"${id.value}"`);
    }
    return toTicketView(ticket);
  }
}
