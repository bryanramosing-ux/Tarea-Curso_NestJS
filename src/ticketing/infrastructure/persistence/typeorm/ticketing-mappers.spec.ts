import { randomUUID } from 'node:crypto';
import { Ticket } from '../../../domain/entities/ticket';
import { TicketAllocation } from '../../../domain/entities/ticket-allocation';
import { PersistedDataCorruptedError } from '../../../../shared/infrastructure/persistence/persisted-data-corrupted.error';
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
const NOW = new Date('2030-01-01T10:00:00Z');

describe('Ticketing mappers', () => {
  it('TicketAllocationMapper maps to a separate ORM class and back', () => {
    const allocation = TicketAllocation.open(
      SaleableEvent.create({ id: EVENT, capacity: 5, startsAt: new Date('2030-01-02T21:00:00Z'), unitPrice: Money.create(100, 'USD'), onSale: true }),
      NOW,
    );
    allocation.sell(Quantity.create(2), 0, NOW);
    const row = TicketAllocationMapper.toPersistence(allocation);
    row.version = 1;

    expect(row).toBeInstanceOf(TicketAllocationOrmEntity);
    expect(TicketAllocationMapper.toDomain(row).toPrimitives()).toEqual({ ...allocation.toPrimitives(), version: 1 });

    row.sold = 9;
    expect(() => TicketAllocationMapper.toDomain(row)).toThrow(PersistedDataCorruptedError);
  });

  it('TicketMapper maps to a separate ORM class and back', () => {
    const ticket = Ticket.issue(
      {
        id: TicketId.create(randomUUID()),
        eventId: EVENT,
        holderName: HolderName.create('Ana'),
        holderEmail: HolderEmail.create('ana@mail.com'),
        codeHash: TicketCodeHash.create('c'.repeat(64)),
        price: Money.create(100, 'USD'),
      },
      NOW,
    );
    const row = TicketMapper.toPersistence(ticket);
    row.version = 1;

    expect(row).toBeInstanceOf(TicketOrmEntity);
    expect(row).not.toBeInstanceOf(Ticket);
    expect(TicketMapper.toDomain(row).toPrimitives()).toEqual({ ...ticket.toPrimitives(), version: 1 });

    row.status = 'USED'; // USED sin fecha de uso: fila corrupta -> error del servidor
    expect(() => TicketMapper.toDomain(row)).toThrow(PersistedDataCorruptedError);
  });
});
