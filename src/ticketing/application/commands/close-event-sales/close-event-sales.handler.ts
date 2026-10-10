import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { backoff } from '../../../../shared/application/retry';
import { CLOCK, Clock } from '../../../../shared/domain/ports/clock.port';
import { DomainEvent } from '../../../../shared/domain/domain-event';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { Ticket } from '../../../domain/entities/ticket';
import { TicketAllocation } from '../../../domain/entities/ticket-allocation';
import {
  EventNotAvailableForSaleError,
  EventNotCancelledError,
  SalesConcurrentModificationError,
  TicketConcurrentModificationError,
} from '../../../domain/errors/ticketing.errors';
import { EVENT_CATALOG, EventCatalog } from '../../../domain/ports/event-catalog.port';
import { TICKET_ALLOCATION_REPOSITORY, TicketAllocationRepository } from '../../../domain/ports/ticket-allocation.repository';
import { TICKET_REPOSITORY, TicketRepository } from '../../../domain/ports/ticket.repository';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { CloseEventSalesCommand, CloseEventSalesResult } from './close-event-sales.command';

/** Intentos por agregado si otra operación lo modifica en paralelo. */
export const CLOSE_SALES_MAX_ATTEMPTS = 10;
/** Entradas que se leen y reembolsan por lote (no se cargan 100.000 en memoria). */
export const REFUND_BATCH_SIZE = 200;
const RETRY_JITTER_MS = 20;

/**
 * RN-014. Idempotente: se puede ejecutar varias veces sobre el mismo evento.
 *  1. Comprueba en el catálogo (ACL) que el evento está cancelado.
 *  2. Cierra el cupo; si el evento nunca vendió nada, CREA un cupo cerrado:
 *     así una primera compra simultánea choca con él (clave primaria) en lugar
 *     de abrir una venta nueva para un evento cancelado.
 *  3. Reembolsa por lotes las entradas emitidas. Una entrada que, al releerla,
 *     ya fue usada o reembolsada se omite.
 * No lo pide un usuario sino un evento, así que no puede devolver un 409 a
 * nadie: ante una modificación concurrente relee y reintenta.
 */
@CommandHandler(CloseEventSalesCommand)
export class CloseEventSalesHandler implements ICommandHandler<CloseEventSalesCommand> {
  constructor(
    @Inject(TICKET_ALLOCATION_REPOSITORY) private readonly allocations: TicketAllocationRepository,
    @Inject(TICKET_REPOSITORY) private readonly tickets: TicketRepository,
    @Inject(EVENT_CATALOG) private readonly catalog: EventCatalog,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CloseEventSalesCommand): Promise<CloseEventSalesResult> {
    const eventId = EventReference.create(command.eventId);
    const event = await this.catalog.findEvent(eventId);
    if (!event) {
      throw new EventNotAvailableForSaleError(eventId.value);
    }
    if (!event.isCancelled()) {
      throw new EventNotCancelledError(eventId.value);
    }

    const events: DomainEvent[] = [];
    for (let attempt = 1; ; attempt++) {
      const now = this.clock.now();
      const allocation: TicketAllocation =
        (await this.allocations.findByEvent(eventId)) ?? TicketAllocation.closedFor(event, now);
      allocation.close(now);
      try {
        await this.allocations.save(allocation);
        events.push(...allocation.pullDomainEvents());
        break;
      } catch (error) {
        if (!(error instanceof SalesConcurrentModificationError) || attempt >= CLOSE_SALES_MAX_ATTEMPTS) {
          throw error;
        }
        await backoff(attempt, RETRY_JITTER_MS);
      }
    }

    const refundedTicketIds: string[] = [];
    for (let batch = await this.tickets.findIssuedByEvent(eventId, REFUND_BATCH_SIZE); batch.length > 0; ) {
      const refunded: Ticket[] = [];
      for (const candidate of batch) {
        let ticket: Ticket | null = candidate;
        for (let attempt = 1; ticket && ticket.status.isIssued(); attempt++) {
          ticket.refund(this.clock.now());
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
      events.push(...refunded.flatMap((ticket) => ticket.pullDomainEvents()));
      refundedTicketIds.push(...refunded.map((ticket) => ticket.id.value));
      batch = await this.tickets.findIssuedByEvent(eventId, REFUND_BATCH_SIZE);
    }

    // DESPUÉS de persistir todo, se publican los hechos (SalesClosed, TicketRefunded...).
    await this.eventPublisher.publishAll(events);

    return { refundedTicketIds };
  }
}
