import { Ticket } from '../../../domain/entities/ticket';
import { TicketAllocation } from '../../../domain/entities/ticket-allocation';
import { TicketingInvariantViolationError } from '../../../domain/errors/ticketing.errors';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { HolderEmail } from '../../../domain/value-objects/holder-email';
import { HolderName } from '../../../domain/value-objects/holder-name';
import { Money } from '../../../domain/value-objects/money';
import { Quantity } from '../../../domain/value-objects/quantity';
import { SaleableEvent } from '../../../domain/value-objects/saleable-event';
import { TicketCodeHash } from '../../../domain/value-objects/ticket-code-hash';
import { TicketId } from '../../../domain/value-objects/ticket-id';
import { TicketAllocationMapper } from './ticket-allocation.mapper';
import { TicketAllocationOrmEntity } from './ticket-allocation.orm-entity';
import { TicketMapper } from './ticket.mapper';
import { TicketOrmEntity } from './ticket.orm-entity';

const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');

describe('Ticketing mappers', () => {
  it('TicketAllocationMapper maps to a separate ORM class and back', () => {
    const allocation = TicketAllocation.open(
      SaleableEvent.create({ id: EVENT, capacity: 5, startsAt: new Date(Date.now() + 864e5), unitPrice: Money.create(100, 'USD'), onSale: true }),
    );
    allocation.sell(Quantity.create(2));
    const row = TicketAllocationMapper.toPersistence(allocation);
    row.version = 1;

    expect(row).toBeInstanceOf(TicketAllocationOrmEntity);
    expect(TicketAllocationMapper.toDomain(row).toPrimitives()).toEqual({ ...allocation.toPrimitives(), version: 1 });

    row.sold = 9;
    expect(() => TicketAllocationMapper.toDomain(row)).toThrow(TicketingInvariantViolationError);
  });

  it('TicketMapper maps to a separate ORM class and back', () => {
    const ticket = Ticket.issue({
      id: TicketId.generate(),
      eventId: EVENT,
      holderName: HolderName.create('Ana'),
      holderEmail: HolderEmail.create('ana@mail.com'),
      codeHash: TicketCodeHash.create('c'.repeat(64)),
      price: Money.create(100, 'USD'),
    });
    const row = TicketMapper.toPersistence(ticket);
    row.version = 1;

    expect(row).toBeInstanceOf(TicketOrmEntity);
    expect(row).not.toBeInstanceOf(Ticket);
    expect(TicketMapper.toDomain(row).toPrimitives()).toEqual({ ...ticket.toPrimitives(), version: 1 });
  });
});
