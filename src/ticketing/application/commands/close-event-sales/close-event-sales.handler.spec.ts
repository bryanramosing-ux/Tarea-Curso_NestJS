import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { Ticket } from '../../../domain/entities/ticket';
import { TicketConcurrentModificationError } from '../../../domain/errors/ticketing.errors';
import { SalesClosed } from '../../../domain/events/sales-closed.event';
import { TicketRefunded } from '../../../domain/events/ticket-refunded.event';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { Money } from '../../../domain/value-objects/money';
import { SaleableEvent } from '../../../domain/value-objects/saleable-event';
import { TicketId } from '../../../domain/value-objects/ticket-id';
import { InMemoryEventCatalog } from '../../../infrastructure/adapters/in-memory-event-catalog';
import { InMemoryTicketAllocationRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket-allocation.repository';
import { InMemoryTicketRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket.repository';
import { HmacTicketCodeHasher } from '../../../infrastructure/security/hmac-ticket-code-hasher';
import { PurchaseTicketsCommand } from '../purchase-tickets/purchase-tickets.command';
import { PurchaseTicketsHandler } from '../purchase-tickets/purchase-tickets.handler';
import { CloseEventSalesCommand } from './close-event-sales.command';
import { CLOSE_SALES_MAX_ATTEMPTS, CloseEventSalesHandler } from './close-event-sales.handler';

const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');

describe('CloseEventSalesHandler (RN-014)', () => {
  let allocations: InMemoryTicketAllocationRepository;
  let tickets: InMemoryTicketRepository;
  let events: InMemoryDomainEventPublisher;
  let handler: CloseEventSalesHandler;
  let bought: { id: string; code: string }[];

  beforeEach(async () => {
    allocations = new InMemoryTicketAllocationRepository();
    tickets = new InMemoryTicketRepository();
    const catalog = new InMemoryEventCatalog();
    catalog.add(
      SaleableEvent.create({
        id: EVENT,
        capacity: 10,
        startsAt: new Date(Date.now() + 864e5),
        unitPrice: Money.create(1000, 'USD'),
        onSale: true,
      }),
    );
    const purchase = new PurchaseTicketsHandler(
      allocations,
      tickets,
      catalog,
      new HmacTicketCodeHasher('a-very-long-server-secret-for-tests-0123456789'),
      new InMemoryDomainEventPublisher(),
    );
    bought = (await purchase.execute(new PurchaseTicketsCommand(EVENT.value, 3, 'Ana', 'ana@mail.com'))).tickets;
    events = new InMemoryDomainEventPublisher();
    handler = new CloseEventSalesHandler(allocations, tickets, events);
  });

  const load = async (id: string): Promise<Ticket> => (await tickets.findById(TicketId.create(id)))!;

  it('closes the sales and refunds every unused ticket, keeping used ones', async () => {
    const used = await load(bought[0].id);
    used.checkIn();
    await tickets.save(used);

    const result = await handler.execute(new CloseEventSalesCommand(EVENT.value));

    expect(result.refundedTicketIds.sort()).toEqual([bought[1].id, bought[2].id].sort());
    expect((await allocations.findByEvent(EVENT))?.status.value).toBe('CLOSED');
    expect((await load(bought[0].id)).status.value).toBe('USED');
    expect(events.published.filter((event) => event instanceof SalesClosed)).toHaveLength(1);
    expect(events.published.filter((event) => event instanceof TicketRefunded)).toHaveLength(2);
  });

  it('is safe to run twice (idempotent)', async () => {
    await handler.execute(new CloseEventSalesCommand(EVENT.value));
    const second = await handler.execute(new CloseEventSalesCommand(EVENT.value));
    expect(second.refundedTicketIds).toEqual([]);
  });

  it('works when nothing was sold yet', async () => {
    const empty = new CloseEventSalesHandler(
      new InMemoryTicketAllocationRepository(),
      new InMemoryTicketRepository(),
      new InMemoryDomainEventPublisher(),
    );
    await expect(empty.execute(new CloseEventSalesCommand(EVENT.value))).resolves.toEqual({ refundedTicketIds: [] });
  });

  it('reloads and skips a ticket that was used concurrently', async () => {
    const save = tickets.save.bind(tickets);
    let raced = false;
    jest.spyOn(tickets, 'save').mockImplementation(async (ticket) => {
      if (!raced && ticket.id.value === bought[0].id) {
        raced = true;
        const rival = (await tickets.findById(ticket.id))!;
        rival.checkIn();
        await save(rival);
        throw new TicketConcurrentModificationError(ticket.id.value);
      }
      await save(ticket);
    });

    const result = await handler.execute(new CloseEventSalesCommand(EVENT.value));

    expect(result.refundedTicketIds).not.toContain(bought[0].id);
    expect((await load(bought[0].id)).status.value).toBe('USED');
  });

  it(`gives up after ${CLOSE_SALES_MAX_ATTEMPTS} conflicts on the same ticket`, async () => {
    const save = tickets.save.bind(tickets);
    jest.spyOn(tickets, 'save').mockImplementation(async (ticket) => {
      if (ticket.id.value === bought[0].id) {
        throw new TicketConcurrentModificationError(ticket.id.value);
      }
      await save(ticket);
    });
    await expect(handler.execute(new CloseEventSalesCommand(EVENT.value))).rejects.toBeInstanceOf(
      TicketConcurrentModificationError,
    );
  });
});
