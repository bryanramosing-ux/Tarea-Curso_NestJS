import { TicketAllocation } from '../../../domain/entities/ticket-allocation';
import { SalesConcurrentModificationError } from '../../../domain/errors/ticketing.errors';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { Money } from '../../../domain/value-objects/money';
import { Quantity } from '../../../domain/value-objects/quantity';
import { SaleableEvent } from '../../../domain/value-objects/saleable-event';
import { TicketCodeHash } from '../../../domain/value-objects/ticket-code-hash';
import { TicketId } from '../../../domain/value-objects/ticket-id';
import { InMemoryTicketAllocationRepository } from './in-memory-ticket-allocation.repository';
import { InMemoryTicketRepository } from './in-memory-ticket.repository';

const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');
const open = () =>
  TicketAllocation.open(
    SaleableEvent.create({ id: EVENT, capacity: 3, startsAt: new Date(Date.now() + 864e5), unitPrice: Money.create(100, 'USD'), onSale: true }),
  );

describe('In-memory ticketing repositories (contrato de los puertos)', () => {
  it('return null instead of throwing when nothing is found', async () => {
    await expect(new InMemoryTicketAllocationRepository().findByEvent(EVENT)).resolves.toBeNull();
    const tickets = new InMemoryTicketRepository();
    await expect(tickets.findById(TicketId.generate())).resolves.toBeNull();
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
    allocation.sell(Quantity.create(2));
    await repository.save(allocation);

    const buyerA = (await repository.findByEvent(EVENT))!;
    const buyerB = (await repository.findByEvent(EVENT))!;
    buyerA.sell(Quantity.create(1));
    buyerB.sell(Quantity.create(1));
    await repository.save(buyerA);

    await expect(repository.save(buyerB)).rejects.toBeInstanceOf(SalesConcurrentModificationError);
    expect((await repository.findByEvent(EVENT))?.sold).toBe(3);
  });
});
