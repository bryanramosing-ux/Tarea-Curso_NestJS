import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EventNotAvailableForSaleError } from '../../../domain/errors/ticketing.errors';
import { EVENT_CATALOG, EventCatalog } from '../../../domain/ports/event-catalog.port';
import { TICKET_ALLOCATION_REPOSITORY, TicketAllocationRepository } from '../../../domain/ports/ticket-allocation.repository';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { AvailabilityView } from '../../views/availability.view';
import { GetEventAvailabilityQuery } from './get-event-availability.query';

/**
 * Si ya hubo ventas, responde con el cupo; si no, con los datos del catálogo
 * (todavía no se ha vendido nada). La venta está abierta si se acepta comprar ahora.
 */
@QueryHandler(GetEventAvailabilityQuery)
export class GetEventAvailabilityHandler implements IQueryHandler<GetEventAvailabilityQuery> {
  constructor(
    @Inject(TICKET_ALLOCATION_REPOSITORY) private readonly allocations: TicketAllocationRepository,
    @Inject(EVENT_CATALOG) private readonly catalog: EventCatalog,
  ) {}

  async execute(query: GetEventAvailabilityQuery): Promise<AvailabilityView> {
    const eventId = EventReference.create(query.eventId);
    const now = new Date();

    const allocation = await this.allocations.findByEvent(eventId);
    if (allocation) {
      return {
        eventId: eventId.value,
        capacity: allocation.capacity,
        sold: allocation.sold,
        available: allocation.available,
        salesOpen: allocation.acceptsSales(now),
        price: { amountCents: allocation.unitPrice.amountCents, currency: allocation.unitPrice.currency },
      };
    }

    const event = await this.catalog.findEvent(eventId);
    if (!event) {
      throw new EventNotAvailableForSaleError(eventId.value);
    }
    return {
      eventId: eventId.value,
      capacity: event.capacity,
      sold: 0,
      available: event.capacity,
      salesOpen: event.isOnSale() && event.startsAt.getTime() > now.getTime(),
      price: { amountCents: event.unitPrice.amountCents, currency: event.unitPrice.currency },
    };
  }
}
