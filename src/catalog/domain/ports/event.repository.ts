import { Event } from '../entities/event';
import { EventId } from '../value-objects/event-id';
import { EventStart } from '../value-objects/event-start';
import { EventStatus } from '../value-objects/event-status';
import { Venue } from '../value-objects/venue';

export const EVENT_REPOSITORY = Symbol('EVENT_REPOSITORY');

export interface EventSearchCriteria {
  status?: EventStatus;
}

/**
 * Puerto de persistencia del agregado Event.
 *  - Las búsquedas devuelven `null` si no hay resultado: decidir si eso es un
 *    error de negocio le corresponde al caso de uso.
 *  - `save` aplica bloqueo optimista (EventConcurrentModificationError) y
 *    respeta la unicidad recinto + hora (EventSlotTakenError, RN-006).
 *  - Los listados se ordenan por fecha de inicio ascendente.
 */
export interface EventRepository {
  save(event: Event): Promise<void>;
  findById(id: EventId): Promise<Event | null>;
  findByVenueAndStart(venue: Venue, startsAt: EventStart): Promise<Event | null>;
  search(criteria: EventSearchCriteria): Promise<Event[]>;
}
