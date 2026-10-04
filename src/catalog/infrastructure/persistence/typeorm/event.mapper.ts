import { Event } from '../../../domain/entities/event';
import { EventOrmEntity } from './event.orm-entity';

/** Traduce entre el agregado Event y su modelo de persistencia. */
export class EventMapper {
  static toDomain(row: EventOrmEntity): Event {
    return Event.fromPrimitives({
      id: row.id,
      name: row.name,
      venue: row.venue,
      startsAt: row.startsAt,
      capacity: row.capacity,
      priceCents: row.priceCents,
      currency: row.currency,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    });
  }

  static toPersistence(event: Event): EventOrmEntity {
    const primitives = event.toPrimitives();
    const row = new EventOrmEntity();
    row.id = primitives.id;
    row.name = primitives.name;
    row.venue = primitives.venue;
    row.startsAt = primitives.startsAt;
    row.capacity = primitives.capacity;
    row.priceCents = primitives.priceCents;
    row.currency = primitives.currency;
    row.status = primitives.status;
    row.createdAt = primitives.createdAt;
    row.updatedAt = primitives.updatedAt;
    row.version = primitives.version;
    return row;
  }
}
