import { DomainErrorKind } from '../../../../shared/domain/domain-exception';
import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import {
  EventNotAvailableForSaleError,
  InvalidQuantityError,
  NotEnoughTicketsError,
  SalesClosedError,
  SalesConcurrentModificationError,
} from '../../../domain/errors/ticketing.errors';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { Money } from '../../../domain/value-objects/money';
import { SaleableEvent } from '../../../domain/value-objects/saleable-event';
import { TicketCode } from '../../../domain/value-objects/ticket-code';
import { InMemoryEventCatalog } from '../../../infrastructure/adapters/in-memory-event-catalog';
import { InMemoryTicketAllocationRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket-allocation.repository';
import { InMemoryTicketRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket.repository';
import { HmacTicketCodeHasher } from '../../../infrastructure/security/hmac-ticket-code-hasher';
import { PurchaseTicketsCommand } from './purchase-tickets.command';
import { PURCHASE_MAX_ATTEMPTS, PurchaseTicketsHandler } from './purchase-tickets.handler';

const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');
const STARTS = new Date(Date.now() + 30 * 864e5);
const buy = (quantity = 2, eventId = EVENT.value) =>
  new PurchaseTicketsCommand(eventId, quantity, '  Ana  Pérez ', ' ANA@mail.com ');

describe('PurchaseTicketsHandler (sin Nest, sin base de datos)', () => {
  let allocations: InMemoryTicketAllocationRepository;
  let tickets: InMemoryTicketRepository;
  let catalog: InMemoryEventCatalog;
  let hasher: HmacTicketCodeHasher;
  let events: InMemoryDomainEventPublisher;
  let handler: PurchaseTicketsHandler;

  beforeEach(() => {
    allocations = new InMemoryTicketAllocationRepository();
    tickets = new InMemoryTicketRepository();
    catalog = new InMemoryEventCatalog();
    hasher = new HmacTicketCodeHasher('a-very-long-server-secret-for-tests-0123456789');
    events = new InMemoryDomainEventPublisher();
    handler = new PurchaseTicketsHandler(allocations, tickets, catalog, hasher, events);
    catalog.add(
      SaleableEvent.create({ id: EVENT, capacity: 3, startsAt: STARTS, unitPrice: Money.create(4500, 'PEN'), onSale: true }),
    );
  });

  it('issues the tickets, charges unit price × quantity and returns each code once (RN-015)', async () => {
    const result = await handler.execute(buy(2));

    expect(result.total).toEqual({ amountCents: 9000, currency: 'PEN' });
    expect(result.tickets).toHaveLength(2);
    expect((await allocations.findByEvent(EVENT))?.sold).toBe(2);
    expect(tickets.all().map((ticket) => ticket.holderEmail)).toEqual(['ana@mail.com', 'ana@mail.com']);
  });

  it('stores only the HMAC of each code, never the code itself (RN-012)', async () => {
    const result = await handler.execute(buy(1));
    const [code] = result.tickets.map((ticket) => ticket.code);

    const stored = tickets.all()[0];
    expect(JSON.stringify(tickets.all())).not.toContain(code);
    expect(stored.codeHash).toBe((await hasher.hash(TicketCode.create(code))).value);
  });

  it('publishes TicketsSold and TicketIssued only after persisting', async () => {
    const order: string[] = [];
    for (const repository of [allocations, tickets] as { save: (x: never) => Promise<void> }[]) {
      const save = repository.save.bind(repository);
      jest.spyOn(repository, 'save').mockImplementation(async (aggregate: never) => {
        order.push('save');
        await save(aggregate);
      });
    }
    jest.spyOn(events, 'publishAll').mockImplementation(async (published) => {
      order.push(`publish:${published.map((event) => event.eventName).join(',')}`);
    });

    await handler.execute(buy(1));

    expect(order).toEqual(['save', 'save', 'publish:ticketing.tickets_sold,ticketing.ticket_issued']);
  });

  it('never sells beyond the capacity (RN-009)', async () => {
    await handler.execute(buy(2));

    const attempt = handler.execute(buy(2));

    await expect(attempt).rejects.toBeInstanceOf(NotEnoughTicketsError);
    await expect(attempt).rejects.toMatchObject({ kind: DomainErrorKind.CONFLICT });
    expect(tickets.all()).toHaveLength(2);
  });

  it('retries when another purchase changed the allocation at the same time', async () => {
    await handler.execute(buy(1));
    const save = allocations.save.bind(allocations);
    let collisions = 1;
    jest.spyOn(allocations, 'save').mockImplementation(async (allocation) => {
      if (collisions-- > 0) {
        throw new SalesConcurrentModificationError(EVENT.value);
      }
      await save(allocation);
    });

    await handler.execute(buy(1));

    expect((await allocations.findByEvent(EVENT))?.sold).toBe(2);
  });

  it(`gives up after ${PURCHASE_MAX_ATTEMPTS} collisions and issues nothing`, async () => {
    const save = jest.spyOn(allocations, 'save').mockRejectedValue(new SalesConcurrentModificationError(EVENT.value));

    await expect(handler.execute(buy(1))).rejects.toBeInstanceOf(SalesConcurrentModificationError);
    expect(save).toHaveBeenCalledTimes(PURCHASE_MAX_ATTEMPTS);
    expect(tickets.all()).toHaveLength(0);
  });

  it('fails with NOT_FOUND for an event that is not in the catalog', async () => {
    await expect(handler.execute(buy(1, '1b4e28ba-2fa1-41d2-883f-0016d3cca427'))).rejects.toBeInstanceOf(
      EventNotAvailableForSaleError,
    );
  });

  it('fails with CONFLICT for a cancelled event (RN-010)', async () => {
    catalog.add(
      SaleableEvent.create({ id: EVENT, capacity: 3, startsAt: STARTS, unitPrice: Money.create(0, 'PEN'), onSale: false }),
    );
    await expect(handler.execute(buy(1))).rejects.toBeInstanceOf(SalesClosedError);
  });

  it('validates the input before touching any repository (RN-008)', async () => {
    const findByEvent = jest.spyOn(allocations, 'findByEvent');
    await expect(handler.execute(buy(11))).rejects.toBeInstanceOf(InvalidQuantityError);
    expect(findByEvent).not.toHaveBeenCalled();
  });
});
