import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { CryptoIdGenerator } from '../../../../shared/infrastructure/ids/crypto-id-generator';
import { InMemoryUnitOfWork } from '../../../../shared/infrastructure/persistence/in-memory-unit-of-work';
import { FixedClock } from '../../../../shared/infrastructure/time/fixed-clock';
import {
  CheckInNotOpenError,
  EventNotAvailableForSaleError,
  InvalidTicketCodeError,
  TicketAlreadyUsedError,
  TicketConcurrentModificationError,
  TicketEventCancelledError,
  TicketForAnotherEventError,
  TicketNotFoundError,
} from '../../../domain/errors/ticketing.errors';
import { TicketCheckedIn } from '../../../domain/events/ticket-checked-in.event';
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
import { CheckInTicketCommand } from './check-in-ticket.command';
import { CheckInTicketHandler } from './check-in-ticket.handler';

const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');
const OTHER_EVENT = EventReference.create('0f8fad5b-d9cb-469f-a165-70867728950e');
const PURCHASED_AT = new Date('2030-01-01T10:00:00.000Z');
const STARTS = new Date('2030-01-10T21:00:00.000Z');
const DOORS = new Date('2030-01-10T20:00:00.000Z');
const catalogEvent = (id: EventReference, onSale = true) =>
  SaleableEvent.create({ id, capacity: 10, startsAt: STARTS, unitPrice: Money.create(1000, 'USD'), onSale });

describe('CheckInTicketHandler (RN-013, RN-016)', () => {
  let tickets: InMemoryTicketRepository;
  let catalog: InMemoryEventCatalog;
  let clock: FixedClock;
  let events: InMemoryDomainEventPublisher;
  let handler: CheckInTicketHandler;
  let ticket: { id: string; code: string };
  const checkIn = (code: string, eventId = EVENT.value) => handler.execute(new CheckInTicketCommand(eventId, code));

  beforeEach(async () => {
    tickets = new InMemoryTicketRepository();
    const hasher = new HmacTicketCodeHasher('a-very-long-server-secret-for-tests-0123456789');
    catalog = new InMemoryEventCatalog();
    catalog.add(catalogEvent(EVENT));
    catalog.add(catalogEvent(OTHER_EVENT));
    clock = new FixedClock(PURCHASED_AT);
    const purchase = new PurchaseTicketsHandler(
      new InMemoryTicketAllocationRepository(),
      tickets,
      catalog,
      hasher,
      new CryptoTicketCodeGenerator(),
      new CryptoIdGenerator(),
      new InMemoryUnitOfWork(),
      clock,
      new InMemoryDomainEventPublisher(),
    );
    [ticket] = (await purchase.execute(new PurchaseTicketsCommand(EVENT.value, 1, 'Ana', 'ana@mail.com'))).tickets;
    clock.set(DOORS);
    events = new InMemoryDomainEventPublisher();
    handler = new CheckInTicketHandler(tickets, catalog, hasher, clock, events);
  });

  it('marks the ticket as used (code is case-insensitive) and publishes TicketCheckedIn', async () => {
    await expect(checkIn(ticket.code.toLowerCase())).resolves.toEqual({ id: ticket.id });

    const stored = await tickets.findById(TicketId.create(ticket.id));
    expect(stored?.status.value).toBe('USED');
    expect(stored?.usedAt).toEqual(DOORS);
    expect(events.published).toEqual([expect.any(TicketCheckedIn)]);
  });

  it('refuses the same code twice', async () => {
    await checkIn(ticket.code);
    await expect(checkIn(ticket.code)).rejects.toBeInstanceOf(TicketAlreadyUsedError);
  });

  it('refuses a valid ticket at the door of another event (RN-016)', async () => {
    await expect(checkIn(ticket.code, OTHER_EVENT.value)).rejects.toBeInstanceOf(TicketForAnotherEventError);
    expect((await tickets.findById(TicketId.create(ticket.id)))?.status.value).toBe('ISSUED');
  });

  it('refuses a ticket of a cancelled event even if it was not refunded yet (RN-016)', async () => {
    catalog.add(catalogEvent(EVENT, false));
    await expect(checkIn(ticket.code)).rejects.toBeInstanceOf(TicketEventCancelledError);
  });

  it('refuses a check-in before the doors open (RN-016)', async () => {
    clock.set('2030-01-10T08:59:59.000Z');
    await expect(checkIn(ticket.code)).rejects.toBeInstanceOf(CheckInNotOpenError);
  });

  it('answers 404 for an event that does not exist', async () => {
    await expect(checkIn(ticket.code, '1b4e28ba-2fa1-41d2-883f-0016d3cca427')).rejects.toBeInstanceOf(
      EventNotAvailableForSaleError,
    );
  });

  it('answers ALREADY_USED (not a technical conflict) when two scanners race', async () => {
    const save = tickets.save.bind(tickets);
    let raced = false;
    jest.spyOn(tickets, 'save').mockImplementation(async (aggregate) => {
      if (!raced) {
        raced = true;
        const rival = (await tickets.findById(aggregate.id))!;
        rival.checkIn(catalogEvent(EVENT), DOORS);
        await save(rival);
        throw new TicketConcurrentModificationError(aggregate.id.value);
      }
      await save(aggregate);
    });

    await expect(checkIn(ticket.code)).rejects.toBeInstanceOf(TicketAlreadyUsedError);
  });

  it('rejects unknown and malformed codes', async () => {
    await expect(checkIn('AAAA-BBBB-CCCC')).rejects.toBeInstanceOf(TicketNotFoundError);
    await expect(checkIn('hola')).rejects.toBeInstanceOf(InvalidTicketCodeError);
  });
});
