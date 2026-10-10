import { DomainErrorKind } from '../../../../shared/domain/domain-exception';
import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { CryptoIdGenerator } from '../../../../shared/infrastructure/ids/crypto-id-generator';
import { InMemoryUnitOfWork } from '../../../../shared/infrastructure/persistence/in-memory-unit-of-work';
import { FixedClock } from '../../../../shared/infrastructure/time/fixed-clock';
import {
  EventAlreadyStartedError,
  EventNotAvailableForSaleError,
  HolderTicketLimitExceededError,
  InvalidQuantityError,
  NotEnoughTicketsError,
  SalesClosedError,
  SalesConcurrentModificationError,
} from '../../../domain/errors/ticketing.errors';
import { EventCatalog } from '../../../domain/ports/event-catalog.port';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { Money } from '../../../domain/value-objects/money';
import { SaleableEvent } from '../../../domain/value-objects/saleable-event';
import { TicketCode } from '../../../domain/value-objects/ticket-code';
import { InMemoryEventCatalog } from '../../../infrastructure/adapters/in-memory-event-catalog';
import { InMemoryTicketAllocationRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket-allocation.repository';
import { InMemoryTicketRepository } from '../../../infrastructure/persistence/in-memory/in-memory-ticket.repository';
import { CryptoTicketCodeGenerator } from '../../../infrastructure/security/crypto-ticket-code-generator';
import { HmacTicketCodeHasher } from '../../../infrastructure/security/hmac-ticket-code-hasher';
import { CloseEventSalesCommand } from '../close-event-sales/close-event-sales.command';
import { CloseEventSalesHandler } from '../close-event-sales/close-event-sales.handler';
import { PurchaseTicketsCommand } from './purchase-tickets.command';
import { PURCHASE_MAX_ATTEMPTS, PurchaseTicketsHandler } from './purchase-tickets.handler';

const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');
const NOW = new Date('2030-01-01T10:00:00.000Z');
const STARTS = new Date('2030-01-31T21:00:00.000Z');
const SECRET = 'a-very-long-server-secret-for-tests-0123456789';
const buy = (quantity = 2, eventId = EVENT.value, email = ' ANA@mail.com ') =>
  new PurchaseTicketsCommand(eventId, quantity, '  Ana  Pérez ', email);
const saleable = (overrides: Partial<{ capacity: number; onSale: boolean; price: number }> = {}) =>
  SaleableEvent.create({
    id: EVENT,
    capacity: overrides.capacity ?? 3,
    startsAt: STARTS,
    unitPrice: Money.create(overrides.price ?? 4500, 'PEN'),
    onSale: overrides.onSale ?? true,
  });

describe('PurchaseTicketsHandler (sin Nest, sin base de datos)', () => {
  let allocations: InMemoryTicketAllocationRepository;
  let tickets: InMemoryTicketRepository;
  let catalog: InMemoryEventCatalog;
  let hasher: HmacTicketCodeHasher;
  let events: InMemoryDomainEventPublisher;
  let unitOfWork: InMemoryUnitOfWork;
  let clock: FixedClock;
  let handler: PurchaseTicketsHandler;

  const build = (eventCatalog: EventCatalog = catalog) =>
    new PurchaseTicketsHandler(
      allocations,
      tickets,
      eventCatalog,
      hasher,
      new CryptoTicketCodeGenerator(),
      new CryptoIdGenerator(),
      unitOfWork,
      clock,
      events,
    );

  beforeEach(() => {
    allocations = new InMemoryTicketAllocationRepository();
    tickets = new InMemoryTicketRepository();
    catalog = new InMemoryEventCatalog();
    hasher = new HmacTicketCodeHasher(SECRET);
    events = new InMemoryDomainEventPublisher();
    unitOfWork = new InMemoryUnitOfWork();
    clock = new FixedClock(NOW);
    handler = build();
    catalog.add(saleable());
  });

  it('issues the tickets, charges unit price × quantity and returns each code once (RN-015)', async () => {
    const result = await handler.execute(buy(2));

    expect(result.total).toEqual({ amountCents: 9000, currency: 'PEN' });
    expect(result.tickets).toHaveLength(2);
    expect((await allocations.findByEvent(EVENT))?.sold).toBe(2);
    expect(tickets.all().map((ticket) => ticket.holderEmail)).toEqual(['ana@mail.com', 'ana@mail.com']);
    expect(tickets.all().map((ticket) => ticket.purchasedAt)).toEqual([NOW, NOW]);
  });

  it('stores only the HMAC of each code, never the code itself (RN-012)', async () => {
    const result = await handler.execute(buy(1));
    const [code] = result.tickets.map((ticket) => ticket.code);

    const stored = tickets.all()[0];
    expect(JSON.stringify(tickets.all())).not.toContain(code);
    expect(stored.codeHash).toBe((await hasher.hash(TicketCode.create(code))).value);
  });

  it('reserves the seats and issues the tickets inside ONE unit of work (all or nothing)', async () => {
    const insideUnitOfWork: boolean[] = [];
    const run = unitOfWork.run.bind(unitOfWork);
    let active = false;
    jest.spyOn(unitOfWork, 'run').mockImplementation(async (work) => {
      active = true;
      try {
        return await run(work);
      } finally {
        active = false;
      }
    });
    for (const repository of [allocations, tickets] as { save: (x: never) => Promise<void> }[]) {
      const save = repository.save.bind(repository);
      jest.spyOn(repository, 'save').mockImplementation(async (aggregate: never) => {
        insideUnitOfWork.push(active);
        await save(aggregate);
      });
    }

    await handler.execute(buy(2));

    expect(insideUnitOfWork).toEqual([true, true, true]);
  });

  it('propagates a failure while issuing a ticket (the real unit of work rolls the sale back)', async () => {
    jest.spyOn(tickets, 'save').mockRejectedValueOnce(new Error('connection lost'));
    await expect(handler.execute(buy(1))).rejects.toThrow('connection lost');
    expect(events.published).toHaveLength(0);
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

    const attempt = handler.execute(buy(2, EVENT.value, 'otra@mail.com'));

    await expect(attempt).rejects.toBeInstanceOf(NotEnoughTicketsError);
    await expect(attempt).rejects.toMatchObject({ kind: DomainErrorKind.CONFLICT });
    expect(tickets.all()).toHaveLength(2);
  });

  it('caps one holder at 10 active tickets per event across purchases, ignoring email casing (RN-008)', async () => {
    catalog.add(saleable({ capacity: 100 }));
    await handler.execute(buy(6, EVENT.value, 'fan@mail.com'));

    await expect(handler.execute(buy(5, EVENT.value, 'FAN@mail.com'))).rejects.toBeInstanceOf(HolderTicketLimitExceededError);
    await expect(handler.execute(buy(4, EVENT.value, 'fan@mail.com'))).resolves.toBeDefined();
    await expect(handler.execute(buy(1, EVENT.value, 'otra@mail.com'))).resolves.toBeDefined();
    expect((await allocations.findByEvent(EVENT))?.sold).toBe(11);
  });

  it('does not count refunded tickets towards the holder limit', async () => {
    catalog.add(saleable({ capacity: 100 }));
    await handler.execute(buy(10));
    for (const row of tickets.all()) {
      const ticket = (await tickets.findById({ value: row.id } as never))!;
      ticket.refund(NOW);
      await tickets.save(ticket);
    }
    await expect(handler.execute(buy(10))).resolves.toBeDefined();
  });

  it('does not sell once the event has started (uses the clock port, RN-010)', async () => {
    clock.set(STARTS);
    await expect(handler.execute(buy(1))).rejects.toBeInstanceOf(EventAlreadyStartedError);
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
    expect(unitOfWork.runs).toBe(3);
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
    catalog.add(saleable({ onSale: false }));
    await expect(handler.execute(buy(1))).rejects.toBeInstanceOf(SalesClosedError);
  });

  it('asks the catalog every time: a cancelled event does not sell even if its allocation is still OPEN', async () => {
    await handler.execute(buy(1));
    // El cierre automático falló: el cupo sigue abierto, pero el catálogo ya canceló el evento.
    catalog.add(saleable({ onSale: false }));

    await expect(handler.execute(buy(1))).rejects.toBeInstanceOf(SalesClosedError);
    expect(tickets.all()).toHaveLength(1);
  });

  it('validates the input before touching any repository (RN-008)', async () => {
    const findByEvent = jest.spyOn(allocations, 'findByEvent');
    await expect(handler.execute(buy(11))).rejects.toBeInstanceOf(InvalidQuantityError);
    expect(findByEvent).not.toHaveBeenCalled();
  });

  describe('racing an event cancellation (RN-014)', () => {
    it('a FIRST purchase that read the catalog before the cancellation cannot open sales afterwards', async () => {
      // Reproduce la carrera: la compra lee el catálogo (evento programado) y,
      // antes de crear el cupo, la cancelación termina por completo.
      const closeSales = new CloseEventSalesHandler(allocations, tickets, catalog, clock, events);
      const racingCatalog: EventCatalog = {
        findEvent: async (id) => {
          const snapshot = await catalog.findEvent(id);
          catalog.add(saleable({ onSale: false }));
          await closeSales.execute(new CloseEventSalesCommand(EVENT.value));
          return snapshot;
        },
      };

      await expect(build(racingCatalog).execute(buy(2))).rejects.toBeInstanceOf(SalesClosedError);

      expect(tickets.all()).toHaveLength(0);
      expect((await allocations.findByEvent(EVENT))?.status.value).toBe('CLOSED');
      await expect(handler.execute(buy(1))).rejects.toBeInstanceOf(SalesClosedError);
    });
  });
});
