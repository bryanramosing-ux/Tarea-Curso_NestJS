import { randomUUID } from 'node:crypto';
import { Ticket } from '../../../domain/entities/ticket';
import { TicketAllocation } from '../../../domain/entities/ticket-allocation';
import { SalesConcurrentModificationError } from '../../../domain/errors/ticketing.errors';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { HolderEmail } from '../../../domain/value-objects/holder-email';
import { HolderName } from '../../../domain/value-objects/holder-name';
import { Money } from '../../../domain/value-objects/money';
import { Quantity } from '../../../domain/value-objects/quantity';
import { SaleableEvent } from '../../../domain/value-objects/saleable-event';
import { TicketCodeHash } from '../../../domain/value-objects/ticket-code-hash';
import { TicketId } from '../../../domain/value-objects/ticket-id';
import { InMemoryTicketAllocationRepository } from './in-memory-ticket-allocation.repository';
import { InMemoryTicketRepository } from './in-memory-ticket.repository';

const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');
const NOW = new Date('2030-01-01T10:00:00Z');
const saleable = (id = EVENT) =>
  SaleableEvent.create({ id, capacity: 3, startsAt: new Date('2030-01-02T21:00:00Z'), unitPrice: Money.create(100, 'USD'), onSale: true });
const open = (id = EVENT) => TicketAllocation.open(saleable(id), NOW);
const issue = (eventId: EventReference, email: string) =>
  Ticket.issue(
    {
      id: TicketId.create(randomUUID()),
      eventId,
      holderName: HolderName.create('Ana'),
      holderEmail: HolderEmail.create(email),
      codeHash: TicketCodeHash.create(randomUUID().replace(/-/g, '').repeat(2)),
      price: Money.create(100, 'USD'),
    },
    NOW,
  );

describe('In-memory ticketing repositories (contrato de los puertos)', () => {
  it('return null instead of throwing when nothing is found', async () => {
    await expect(new InMemoryTicketAllocationRepository().findByEvent(EVENT)).resolves.toBeNull();
    const tickets = new InMemoryTicketRepository();
    await expect(tickets.findById(TicketId.create(randomUUID()))).resolves.toBeNull();
    await expect(tickets.findByCodeHash(TicketCodeHash.create('d'.repeat(64)))).resolves.toBeNull();
  });

  it('two first purchases cannot both create the allocation (emulates the primary key)', async () => {
    const repository = new InMemoryTicketAllocationRepository();
    await repository.save(open());
    await expect(repository.save(open())).rejects.toBeInstanceOf(SalesConcurrentModificationError);
  });

  it('two buyers holding stale copies cannot both take the last seat (RN-009)', async () => {
    const repository = new InMemoryTicketAllocationRepository();
    const allocation = open();
    allocation.sell(Quantity.create(2), 0, NOW);
    await repository.save(allocation);

    const buyerA = (await repository.findByEvent(EVENT))!;
    const buyerB = (await repository.findByEvent(EVENT))!;
    buyerA.sell(Quantity.create(1), 0, NOW);
    buyerB.sell(Quantity.create(1), 0, NOW);
    await repository.save(buyerA);

    await expect(repository.save(buyerB)).rejects.toBeInstanceOf(SalesConcurrentModificationError);
    expect((await repository.findByEvent(EVENT))?.sold).toBe(3);
  });

  it('lists only OPEN allocations, ordered by event and paginated by key', async () => {
    const repository = new InMemoryTicketAllocationRepository();
    const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
    for (const id of ids) {
      await repository.save(open(EventReference.create(id)));
    }
    const closed = (await repository.findByEvent(EventReference.create(ids[1])))!;
    closed.close(NOW);
    await repository.save(closed);

    expect((await repository.findOpen(10)).map((allocation) => allocation.eventId.value)).toEqual([ids[0], ids[2]]);
    expect((await repository.findOpen(1)).map((allocation) => allocation.eventId.value)).toEqual([ids[0]]);
    expect((await repository.findOpen(10, EventReference.create(ids[0]))).map((allocation) => allocation.eventId.value)).toEqual([ids[2]]);
  });

  it('counts the active tickets of a holder for one event (RN-008)', async () => {
    const tickets = new InMemoryTicketRepository();
    const other = EventReference.create(randomUUID());
    await tickets.save(issue(EVENT, 'ana@mail.com'));
    const refunded = issue(EVENT, 'ana@mail.com');
    refunded.refund(NOW);
    await tickets.save(refunded);
    await tickets.save(issue(other, 'ana@mail.com'));
    await tickets.save(issue(EVENT, 'otro@mail.com'));

    await expect(tickets.countActiveByEventAndHolder(EVENT, HolderEmail.create('ANA@mail.com'))).resolves.toBe(1);
    await expect(tickets.findIssuedByEvent(EVENT, 1)).resolves.toHaveLength(1);
    await expect(tickets.findIssuedByEvent(EVENT, 10)).resolves.toHaveLength(2);
  });
});
