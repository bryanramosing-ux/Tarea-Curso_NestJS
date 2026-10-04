import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import {
  InvalidTicketCodeError,
  TicketAlreadyUsedError,
  TicketConcurrentModificationError,
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
import { HmacTicketCodeHasher } from '../../../infrastructure/security/hmac-ticket-code-hasher';
import { PurchaseTicketsCommand } from '../purchase-tickets/purchase-tickets.command';
import { PurchaseTicketsHandler } from '../purchase-tickets/purchase-tickets.handler';
import { CheckInTicketCommand } from './check-in-ticket.command';
import { CheckInTicketHandler } from './check-in-ticket.handler';

const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');

describe('CheckInTicketHandler (RN-013)', () => {
  let tickets: InMemoryTicketRepository;
  let events: InMemoryDomainEventPublisher;
  let handler: CheckInTicketHandler;
  let ticket: { id: string; code: string };

  beforeEach(async () => {
    tickets = new InMemoryTicketRepository();
    const hasher = new HmacTicketCodeHasher('a-very-long-server-secret-for-tests-0123456789');
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
      new InMemoryTicketAllocationRepository(),
      tickets,
      catalog,
      hasher,
      new InMemoryDomainEventPublisher(),
    );
    [ticket] = (await purchase.execute(new PurchaseTicketsCommand(EVENT.value, 1, 'Ana', 'ana@mail.com'))).tickets;
    events = new InMemoryDomainEventPublisher();
    handler = new CheckInTicketHandler(tickets, hasher, events);
  });

  it('marks the ticket as used (code is case-insensitive) and publishes TicketCheckedIn', async () => {
    await expect(handler.execute(new CheckInTicketCommand(ticket.code.toLowerCase()))).resolves.toEqual({ id: ticket.id });

    expect((await tickets.findById(TicketId.create(ticket.id)))?.status.value).toBe('USED');
    expect(events.published).toEqual([expect.any(TicketCheckedIn)]);
  });

  it('refuses the same code twice', async () => {
    await handler.execute(new CheckInTicketCommand(ticket.code));
    await expect(handler.execute(new CheckInTicketCommand(ticket.code))).rejects.toBeInstanceOf(TicketAlreadyUsedError);
  });

  it('answers ALREADY_USED (not a technical conflict) when two scanners race', async () => {
    const save = tickets.save.bind(tickets);
    let raced = false;
    jest.spyOn(tickets, 'save').mockImplementation(async (aggregate) => {
      if (!raced) {
        raced = true;
        const rival = (await tickets.findById(aggregate.id))!;
        rival.checkIn();
        await save(rival);
        throw new TicketConcurrentModificationError(aggregate.id.value);
      }
      await save(aggregate);
    });

    await expect(handler.execute(new CheckInTicketCommand(ticket.code))).rejects.toBeInstanceOf(TicketAlreadyUsedError);
  });

  it('rejects unknown and malformed codes', async () => {
    await expect(handler.execute(new CheckInTicketCommand('AAAA-BBBB-CCCC'))).rejects.toBeInstanceOf(TicketNotFoundError);
    await expect(handler.execute(new CheckInTicketCommand('hola'))).rejects.toBeInstanceOf(InvalidTicketCodeError);
  });
});
