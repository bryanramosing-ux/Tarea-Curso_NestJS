import { randomUUID } from 'node:crypto';
import { Event } from '../../../domain/entities/event';
import { PersistedDataCorruptedError } from '../../../../shared/infrastructure/persistence/persisted-data-corrupted.error';
import { Capacity } from '../../../domain/value-objects/capacity';
import { EventId } from '../../../domain/value-objects/event-id';
import { EventName } from '../../../domain/value-objects/event-name';
import { EventStart } from '../../../domain/value-objects/event-start';
import { TicketPrice } from '../../../domain/value-objects/ticket-price';
import { Venue } from '../../../domain/value-objects/venue';
import { EventMapper } from './event.mapper';
import { EventOrmEntity } from './event.orm-entity';

describe('EventMapper', () => {
  const event = Event.schedule(
    {
      id: EventId.create(randomUUID()),
      name: EventName.create('Rock en el Parque'),
      venue: Venue.create('Estadio Nacional'),
      startsAt: EventStart.create('2030-01-02T21:00:00Z'),
      capacity: Capacity.create(500),
      price: TicketPrice.create(4500, 'PEN'),
    },
    new Date('2030-01-01T10:00:00Z'),
  );

  it('maps the domain entity to a different ORM class and back', () => {
    const row = EventMapper.toPersistence(event);
    row.version = 1; // las filas almacenadas siempre tienen versión >= 1

    expect(row).toBeInstanceOf(EventOrmEntity);
    expect(row).not.toBeInstanceOf(Event);
    expect(EventMapper.toDomain(row).toPrimitives()).toEqual({ ...event.toPrimitives(), version: 1 });
  });

  it('refuses to build a domain entity from a corrupt row: a server error (500), not a client one (400)', () => {
    const row = EventMapper.toPersistence(event);
    row.version = 1;
    row.currency = 'XXX';
    expect(() => EventMapper.toDomain(row)).toThrow(PersistedDataCorruptedError);
    expect(() => EventMapper.toDomain(row)).toThrow(new RegExp(`Row ${row.id} of table "events"`));
  });
});
