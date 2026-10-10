import { CryptoIdGenerator } from '../../../../shared/infrastructure/ids/crypto-id-generator';
import { InMemoryUnitOfWork } from '../../../../shared/infrastructure/persistence/in-memory-unit-of-work';
import { FixedClock } from '../../../../shared/infrastructure/time/fixed-clock';
import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { EventNotAvailableForSaleError } from '../../../domain/errors/ticketing.errors';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { Money } from '../../../domain/value-objects/money';
import { SaleableEvent } from '../../../domain/value-objects/saleable-event';
import { InMemoryEventCatalog } from '../../../infrastructure/adapters/in-memory-event-catalog';
import { InMemoryTicketAllocationRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket-allocation.repository';
import { InMemoryTicketRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket.repository';
import { CryptoTicketCodeGenerator } from '../../../infrastructure/security/crypto-ticket-code-generator';
import { HmacTicketCodeHasher } from '../../../infrastructure/security/hmac-ticket-code-hasher';
import { PurchaseTicketsCommand } from '../../commands/purchase-tickets/purchase-tickets.command';
import { PurchaseTicketsHandler } from '../../commands/purchase-tickets/purchase-tickets.handler';
import { GetEventAvailabilityHandler } from './get-event-availability.handler';
import { GetEventAvailabilityQuery } from './get-event-availability.query';

const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');
const NOW = new Date('2030-01-01T10:00:00.000Z');
const STARTS = new Date('2030-01-02T21:00:00.000Z');
const saleable = (onSale = true) =>
  SaleableEvent.create({ id: EVENT, capacity: 5, startsAt: STARTS, unitPrice: Money.create(4500, 'PEN'), onSale });

describe('GetEventAvailabilityHandler', () => {
  let allocations: InMemoryTicketAllocationRepository;
  let catalog: InMemoryEventCatalog;
  let clock: FixedClock;
  let handler: GetEventAvailabilityHandler;

  const buyTwo = () =>
    new PurchaseTicketsHandler(
      allocations,
      new InMemoryTicketRepository(),
      catalog,
      new HmacTicketCodeHasher('a-very-long-server-secret-for-tests-0123456789'),
      new CryptoTicketCodeGenerator(),
      new CryptoIdGenerator(),
      new InMemoryUnitOfWork(),
      clock,
      new InMemoryDomainEventPublisher(),
    ).execute(new PurchaseTicketsCommand(EVENT.value, 2, 'Ana', 'ana@mail.com'));

  beforeEach(() => {
    allocations = new InMemoryTicketAllocationRepository();
    catalog = new InMemoryEventCatalog();
    catalog.add(saleable());
    clock = new FixedClock(NOW);
    handler = new GetEventAvailabilityHandler(allocations, catalog, clock);
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
    await buyTwo();

    await expect(handler.execute(new GetEventAvailabilityQuery(EVENT.value))).resolves.toMatchObject({
      sold: 2,
      available: 3,
      salesOpen: true,
    });
  });

  it('reports sales as closed once the event started (clock port)', async () => {
    await buyTwo();
    clock.set(STARTS);
    await expect(handler.execute(new GetEventAvailabilityQuery(EVENT.value))).resolves.toMatchObject({ salesOpen: false });
  });

  it('reports sales as closed when the catalog cancelled the event, even if the allocation is still OPEN', async () => {
    await buyTwo();
    catalog.add(saleable(false));
    await expect(handler.execute(new GetEventAvailabilityQuery(EVENT.value))).resolves.toMatchObject({ salesOpen: false });
  });

  it('throws NOT_FOUND for an event that is not in the catalog', async () => {
    await expect(
      handler.execute(new GetEventAvailabilityQuery('1b4e28ba-2fa1-41d2-883f-0016d3cca427')),
    ).rejects.toBeInstanceOf(EventNotAvailableForSaleError);
  });
});
