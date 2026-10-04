import { DomainErrorKind } from '../../../shared/domain/domain-exception';
import {
  EventAlreadyCancelledError,
  EventAlreadyStartedError,
  EventInvariantViolationError,
  EventStartInPastError,
  InvalidCapacityError,
  InvalidVenueError,
} from '../errors/event.errors';
import { EventCancelled } from '../events/event-cancelled.event';
import { EventScheduled } from '../events/event-scheduled.event';
import { Capacity } from '../value-objects/capacity';
import { EventId } from '../value-objects/event-id';
import { EventName } from '../value-objects/event-name';
import { EventStart } from '../value-objects/event-start';
import { TicketPrice } from '../value-objects/ticket-price';
import { Venue } from '../value-objects/venue';
import { Event, EventPrimitives } from './event';

const NOW = new Date('2027-01-10T10:00:00.000Z');
const LATER = new Date('2027-01-11T10:00:00.000Z');
const STARTS = '2027-03-20T21:00:00.000Z';

function scheduleEvent(startsAt = STARTS): Event {
  return Event.schedule(
    {
      id: EventId.create('7c9e6679-7425-40de-944b-e07fc1f90ae7'),
      name: EventName.create('Rock en el Parque'),
      venue: Venue.create('Estadio Nacional'),
      startsAt: EventStart.create(startsAt),
      capacity: Capacity.create(500),
      price: TicketPrice.create(4500, 'PEN'),
    },
    NOW,
  );
}

describe('Event aggregate', () => {
  describe('schedule (RN-003)', () => {
    it('creates a SCHEDULED event (version 0) and records EventScheduled', () => {
      const event = scheduleEvent();

      expect(event.status.value).toBe('SCHEDULED');
      expect(event.version).toBe(0);
      expect(event.pullDomainEvents()).toEqual([
        new EventScheduled(event.id.value, 'Rock en el Parque', new Date(STARTS), 500, NOW),
      ]);
    });

    it('refuses to schedule an event in the past or right now', () => {
      expect(() => scheduleEvent('2027-01-09T10:00:00Z')).toThrow(EventStartInPastError);
      expect(() => scheduleEvent(NOW.toISOString())).toThrow(
        expect.objectContaining({ code: 'EVENT_START_IN_PAST', kind: DomainErrorKind.VALIDATION }),
      );
    });
  });

  describe('cancel (RN-007)', () => {
    it('cancels a scheduled event that has not started and records EventCancelled', () => {
      const event = scheduleEvent();
      event.pullDomainEvents();

      event.cancel(LATER);

      expect(event.isCancelled()).toBe(true);
      expect(event.updatedAt).toEqual(LATER);
      expect(event.pullDomainEvents()).toEqual([new EventCancelled(event.id.value, LATER)]);
    });

    it('refuses to cancel twice (CONFLICT)', () => {
      const event = scheduleEvent();
      event.cancel(LATER);
      expect(() => event.cancel(LATER)).toThrow(
        expect.objectContaining({ code: 'EVENT_ALREADY_CANCELLED', kind: DomainErrorKind.CONFLICT }),
      );
      expect(() => event.cancel(LATER)).toThrow(EventAlreadyCancelledError);
    });

    it('refuses to cancel an event that already started', () => {
      const event = scheduleEvent();
      event.pullDomainEvents();
      expect(() => event.cancel(new Date(STARTS))).toThrow(EventAlreadyStartedError);
      expect(event.isCancelled()).toBe(false);
      expect(event.pullDomainEvents()).toEqual([]);
    });
  });

  describe('toPrimitives / fromPrimitives', () => {
    /** Lo que devolvería la base de datos: siempre con versión >= 1. */
    const storedRow = (): EventPrimitives => ({ ...scheduleEvent().toPrimitives(), version: 1 });

    it('round-trips without emitting events', () => {
      const row = storedRow();
      const restored = Event.fromPrimitives(row);
      expect(restored.toPrimitives()).toEqual(row);
      expect(restored.pullDomainEvents()).toEqual([]);
    });

    it('accepts past events when reconstructing (only scheduling requires the future)', () => {
      expect(() => Event.fromPrimitives({ ...storedRow(), startsAt: new Date('2020-01-01T00:00:00Z') })).not.toThrow();
    });

    it('re-validates values, invariants and version', () => {
      const valid = storedRow();
      expect(() => Event.fromPrimitives({ ...valid, venue: 'x' })).toThrow(InvalidVenueError);
      expect(() => Event.fromPrimitives({ ...valid, capacity: 0 })).toThrow(InvalidCapacityError);
      expect(() => Event.fromPrimitives({ ...valid, updatedAt: new Date('2000-01-01') })).toThrow(
        EventInvariantViolationError,
      );
      expect(() => Event.fromPrimitives({ ...valid, version: 0 })).toThrow(
        expect.objectContaining({ code: 'INVALID_AGGREGATE_VERSION' }),
      );
    });
  });
});
