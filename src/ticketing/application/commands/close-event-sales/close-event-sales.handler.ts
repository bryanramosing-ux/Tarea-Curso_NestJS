import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DomainEvent } from '../../../../shared/domain/domain-event';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { Ticket } from '../../../domain/entities/ticket';
import { TicketAllocation } from '../../../domain/entities/ticket-allocation';
import {
  SalesConcurrentModificationError,
  TicketConcurrentModificationError,
} from '../../../domain/errors/ticketing.errors';
import { TICKET_ALLOCATION_REPOSITORY, TicketAllocationRepository } from '../../../domain/ports/ticket-allocation.repository';
import { TICKET_REPOSITORY, TicketRepository } from '../../../domain/ports/ticket.repository';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { CloseEventSalesCommand, CloseEventSalesResult } from './close-event-sales.command';

/** Intentos por agregado si otra operación lo modifica en paralelo. */
export const CLOSE_SALES_MAX_ATTEMPTS = 3;

/**
 * RN-014. No lo pide un usuario sino un evento, así que no puede devolver un
 * 409 a nadie: ante una modificación concurrente relee y reintenta. Una
 * entrada que, al releerla, ya fue usada o reembolsada se omite.
 */
@CommandHandler(CloseEventSalesCommand)
export class CloseEventSalesHandler implements ICommandHandler<CloseEventSalesCommand> {
  constructor(
    @Inject(TICKET_ALLOCATION_REPOSITORY) private readonly allocations: TicketAllocationRepository,
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CloseEventSalesCommand): Promise<CloseEventSalesResult> {
    const eventId = EventReference.create(command.eventId);
    const events: DomainEvent[] = [];

    for (let attempt = 1; ; attempt++) {
      const allocation: TicketAllocation | null = await this.allocations.findByEvent(eventId);
      if (!allocation) {
        break;
      }
      allocation.close();
      try {
        await this.allocations.save(allocation);
        events.push(...allocation.pullDomainEvents());
        break;
      } catch (error) {
        if (!(error instanceof SalesConcurrentModificationError) || attempt >= CLOSE_SALES_MAX_ATTEMPTS) {
          throw error;
        }
      }
    }

    const refunded: Ticket[] = [];
    for (const candidate of await this.tickets.findIssuedByEvent(eventId)) {
      let ticket: Ticket | null = candidate;
      for (let attempt = 1; ticket && ticket.status.isIssued(); attempt++) {
        ticket.refund();
        try {
          await this.tickets.save(ticket);
          refunded.push(ticket);
          break;
        } catch (error) {
          if (!(error instanceof TicketConcurrentModificationError) || attempt >= CLOSE_SALES_MAX_ATTEMPTS) {
            throw error;
          }
          ticket = await this.tickets.findById(ticket.id);
        }
      }
    }

    await this.eventPublisher.publishAll([...events, ...refunded.flatMap((ticket) => ticket.pullDomainEvents())]);

    return { refundedTicketIds: refunded.map((ticket) => ticket.id.value) };
  }
}
