import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { EventNotAvailableForSaleError } from '../../../domain/errors/ticketing.errors';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { Money } from '../../../domain/value-objects/money';
import { SaleableEvent } from '../../../domain/value-objects/saleable-event';
import { InMemoryEventCatalog } from '../../../infrastructure/adapters/in-memory-event-catalog';
import { InMemoryTicketAllocationRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket-allocation.repository';
import { InMemoryTicketRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket.repository';
import { HmacTicketCodeHasher } from '../../../infrastructure/security/hmac-ticket-code-hasher';
import { PurchaseTicketsCommand } from '../../commands/purchase-tickets/purchase-tickets.command';
import { PurchaseTicketsHandler } from '../../commands/purchase-tickets/purchase-tickets.handler';
import { GetEventAvailabilityHandler } from './get-event-availability.handler';
import { GetEventAvailabilityQuery } from './get-event-availability.query';

const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');

describe('GetEventAvailabilityHandler', () => {
  let allocations: InMemoryTicketAllocationRepository;
  let catalog: InMemoryEventCatalog;
  let handler: GetEventAvailabilityHandler;

  beforeEach(() => {
    allocations = new InMemoryTicketAllocationRepository();
    catalog = new InMemoryEventCatalog();
    catalog.add(
      SaleableEvent.create({
        id: EVENT,
        capacity: 5,
        startsAt: new Date(Date.now() + 864e5),
        unitPrice: Money.create(4500, 'PEN'),
        onSale: true,
      }),
    );
    handler = new GetEventAvailabilityHandler(allocations, catalog);
  });

  it('uses the catalog data while nothing has been sold', async () => {
    await expect(handler.execute(new GetEventAvailabilityQuery(EVENT.value))).resolves.toEqual({
      eventId: EVENT.value,
      capacity: 5,
      sold: 0,
      available: 5,
      salesOpen: true,
      price: { amountCents: 4500, currency: 'PEN' },
    });
  });

  it('uses the allocation once tickets were sold', async () => {
    await new PurchaseTicketsHandler(
      allocations,
      new InMemoryTicketRepository(),
      catalog,
      new HmacTicketCodeHasher('a-very-long-server-secret-for-tests-0123456789'),
      new InMemoryDomainEventPublisher(),
    ).execute(new PurchaseTicketsCommand(EVENT.value, 2, 'Ana', 'ana@mail.com'));

    await expect(handler.execute(new GetEventAvailabilityQuery(EVENT.value))).resolves.toMatchObject({
      sold: 2,
      available: 3,
      salesOpen: true,
    });
  });

  it('throws NOT_FOUND for an event that is not in the catalog', async () => {
    await expect(
      handler.execute(new GetEventAvailabilityQuery('1b4e28ba-2fa1-41d2-883f-0016d3cca427')),
    ).rejects.toBeInstanceOf(EventNotAvailableForSaleError);
  });
});
