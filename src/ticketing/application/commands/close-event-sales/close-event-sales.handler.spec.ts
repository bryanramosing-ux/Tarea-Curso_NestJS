import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { CryptoIdGenerator } from '../../../../shared/infrastructure/ids/crypto-id-generator';
import { InMemoryUnitOfWork } from '../../../../shared/infrastructure/persistence/in-memory-unit-of-work';
import { FixedClock } from '../../../../shared/infrastructure/time/fixed-clock';
import { Ticket } from '../../../domain/entities/ticket';
import {
  EventNotAvailableForSaleError,
  EventNotCancelledError,
  SalesConcurrentModificationError,
  TicketConcurrentModificationError,
} from '../../../domain/errors/ticketing.errors';
import { SalesClosed } from '../../../domain/events/sales-closed.event';
import { TicketRefunded } from '../../../domain/events/ticket-refunded.event';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { Money } from '../../../domain/value-objects/money';
import { SaleableEvent } from '../../../domain/value-objects/saleable-event';
import { TicketId } from '../../../domain/value-objects/ticket-id';
import { InMemoryEventCatalog } from '../../../infrastructure/adapters/in-memory-event-catalog';
import { InMemoryTicketAllocationRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket-allocation.repository';
import { InMemoryTicketRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket.repository';
import { CryptoTicketCodeGenerator } from '../../../infrastructure/security/crypto-ticket-code-generator';
import { HmacTicketCodeHasher } from '../../../infrastructure/security/hmac-ticket-code-hasher';
import { PurchaseTicketsCommand } from '../purchase-tickets/purchase-tickets.command';
import { PurchaseTicketsHandler } from '../purchase-tickets/purchase-tickets.handler';
import { CloseEventSalesCommand } from './close-event-sales.command';
import { CLOSE_SALES_MAX_ATTEMPTS, CloseEventSalesHandler, REFUND_BATCH_SIZE } from './close-event-sales.handler';

const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');
const NOW = new Date('2030-01-01T10:00:00.000Z');
const STARTS = new Date('2030-01-01T20:00:00.000Z');
const event = (onSale: boolean, capacity = 10) =>
  SaleableEvent.create({ id: EVENT, capacity, startsAt: STARTS, unitPrice: Money.create(1000, 'USD'), onSale });

describe('CloseEventSalesHandler (RN-014)', () => {
  let allocations: InMemoryTicketAllocationRepository;
  let tickets: InMemoryTicketRepository;
  let catalog: InMemoryEventCatalog;
  let clock: FixedClock;
  let events: InMemoryDomainEventPublisher;
  let handler: CloseEventSalesHandler;
  let bought: { id: string; code: string }[];

  const purchase = (quantity: number, email = 'ana@mail.com') =>
    new PurchaseTicketsHandler(
      allocations,
      tickets,
      catalog,
      new HmacTicketCodeHasher('a-very-long-server-secret-for-tests-0123456789'),
      new CryptoTicketCodeGenerator(),
      new CryptoIdGenerator(),
      new InMemoryUnitOfWork(),
      clock,
      new InMemoryDomainEventPublisher(),
    ).execute(new PurchaseTicketsCommand(EVENT.value, quantity, 'Ana', email));

  beforeEach(async () => {
    allocations = new InMemoryTicketAllocationRepository();
    tickets = new InMemoryTicketRepository();
    catalog = new InMemoryEventCatalog();
    clock = new FixedClock(NOW);
    catalog.add(event(true));
    bought = (await purchase(3)).tickets;
    catalog.add(event(false)); // el catálogo canceló el evento
    events = new InMemoryDomainEventPublisher();
    handler = new CloseEventSalesHandler(allocations, tickets, catalog, clock, events);
  });

  const load = async (id: string): Promise<Ticket> => (await tickets.findById(TicketId.create(id)))!;

  it('closes the sales and refunds every unused ticket, keeping used ones', async () => {
    const used = await load(bought[0].id);
    used.checkIn(event(true), NOW);
    await tickets.save(used);

    const result = await handler.execute(new CloseEventSalesCommand(EVENT.value));

    expect(result.refundedTicketIds.sort()).toEqual([bought[1].id, bought[2].id].sort());
    expect((await allocations.findByEvent(EVENT))?.status.value).toBe('CLOSED');
    expect((await load(bought[0].id)).status.value).toBe('USED');
    expect(events.published.filter((published) => published instanceof SalesClosed)).toHaveLength(1);
    expect(events.published.filter((published) => published instanceof TicketRefunded)).toHaveLength(2);
  });

  it('is safe to run twice (idempotent)', async () => {
    await handler.execute(new CloseEventSalesCommand(EVENT.value));
    const second = await handler.execute(new CloseEventSalesCommand(EVENT.value));
    expect(second.refundedTicketIds).toEqual([]);
  });

  it('creates an already CLOSED allocation when nothing was sold, so a later first purchase cannot open sales', async () => {
    allocations = new InMemoryTicketAllocationRepository();
    tickets = new InMemoryTicketRepository();
    handler = new CloseEventSalesHandler(allocations, tickets, catalog, clock, events);

    await expect(handler.execute(new CloseEventSalesCommand(EVENT.value))).resolves.toEqual({ refundedTicketIds: [] });

    const allocation = await allocations.findByEvent(EVENT);
    expect(allocation?.status.value).toBe('CLOSED');
    expect(allocation?.sold).toBe(0);
    expect(events.published).toEqual([new SalesClosed(EVENT.value, NOW)]);
  });

  it('retries when a purchase created or changed the allocation at the same time', async () => {
    const save = allocations.save.bind(allocations);
    let collisions = 2;
    jest.spyOn(allocations, 'save').mockImplementation(async (allocation) => {
      if (collisions-- > 0) {
        throw new SalesConcurrentModificationError(EVENT.value);
      }
      await save(allocation);
    });

    await handler.execute(new CloseEventSalesCommand(EVENT.value));

    expect((await allocations.findByEvent(EVENT))?.status.value).toBe('CLOSED');
  });

  it('refuses to close the sales of an event that is still scheduled, or unknown', async () => {
    catalog.add(event(true));
    await expect(handler.execute(new CloseEventSalesCommand(EVENT.value))).rejects.toBeInstanceOf(EventNotCancelledError);
    expect((await allocations.findByEvent(EVENT))?.status.value).toBe('OPEN');
    await expect(handler.execute(new CloseEventSalesCommand('1b4e28ba-2fa1-41d2-883f-0016d3cca427'))).rejects.toBeInstanceOf(
      EventNotAvailableForSaleError,
    );
  });

  it(`refunds in batches of ${REFUND_BATCH_SIZE} until no issued ticket is left`, async () => {
    allocations = new InMemoryTicketAllocationRepository();
    tickets = new InMemoryTicketRepository();
    catalog.add(event(true, 1000));
    for (let i = 0; i < 25; i++) {
      await purchase(10, `fan${i}@mail.com`);
    }
    catalog.add(event(false, 1000));
    handler = new CloseEventSalesHandler(allocations, tickets, catalog, clock, events);
    const findIssued = jest.spyOn(tickets, 'findIssuedByEvent');

    const result = await handler.execute(new CloseEventSalesCommand(EVENT.value));

    expect(result.refundedTicketIds).toHaveLength(250);
    expect(findIssued).toHaveBeenCalledTimes(3); // 200 + 50 + lote vacío
    expect(findIssued.mock.calls.every(([, limit]) => limit === REFUND_BATCH_SIZE)).toBe(true);
    expect(tickets.all().every((ticket) => ticket.status === 'REFUNDED')).toBe(true);
  });

  it('reloads and skips a ticket that was used concurrently', async () => {
    const save = tickets.save.bind(tickets);
    let raced = false;
    jest.spyOn(tickets, 'save').mockImplementation(async (ticket) => {
      if (!raced && ticket.id.value === bought[0].id) {
        raced = true;
        const rival = (await tickets.findById(ticket.id))!;
        rival.checkIn(event(true), NOW);
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
