import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import {
  EventAlreadyCancelledError,
  EventAlreadyStartedError,
  EventInvariantViolationError,
  EventStartInPastError,
} from '../errors/event.errors';
import { EventCancelled } from '../events/event-cancelled.event';
import { EventScheduled } from '../events/event-scheduled.event';
import { Capacity } from '../value-objects/capacity';
import { EventId } from '../value-objects/event-id';
import { EventName } from '../value-objects/event-name';
import { EventStart } from '../value-objects/event-start';
import { EventStatus } from '../value-objects/event-status';
import { TicketPrice } from '../value-objects/ticket-price';
import { Venue } from '../value-objects/venue';

export interface EventPrimitives {
  id: string;
  name: string;
  venue: string;
  startsAt: Date;
  capacity: number;
  priceCents: number;
  currency: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface ScheduleEventProps {
  id: EventId;
  name: EventName;
  venue: Venue;
  startsAt: EventStart;
  capacity: Capacity;
  price: TicketPrice;
}

/**
 * Agregado Event (contexto Catálogo): un concierto, obra o conferencia.
 * Solo cambia mediante métodos con intención de negocio:
 *  - RN-003 solo se programa a futuro;
 *  - RN-007 solo se cancela si está programado y no ha empezado.
 */
export class Event extends AggregateRoot {
  private constructor(
    private readonly _id: EventId,
    private readonly _name: EventName,
    private readonly _venue: Venue,
    private readonly _startsAt: EventStart,
    private readonly _capacity: Capacity,
    private readonly _price: TicketPrice,
    private _status: EventStatus,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    version: number,
  ) {
    super(version);
    this.assertValidTimestamps();
  }

  /** Programa un evento nuevo (RN-003). Emite EventScheduled. */
  static schedule(props: ScheduleEventProps, now: Date = new Date()): Event {
    if (!props.startsAt.isAfter(now)) {
      throw new EventStartInPastError();
    }
    const event = new Event(
      props.id,
      props.name,
      props.venue,
      props.startsAt,
      props.capacity,
      props.price,
      EventStatus.scheduled(),
      now,
      now,
      0,
    );
    event.record(
      new EventScheduled(event._id.value, event._name.value, event._startsAt.value, event._capacity.value, now),
    );
    return event;
  }

  /** Reconstrucción desde persistencia: revalida todo con los value objects. */
  static fromPrimitives(primitives: EventPrimitives): Event {
    return new Event(
      EventId.create(primitives.id),
      EventName.create(primitives.name),
      Venue.create(primitives.venue),
      EventStart.create(primitives.startsAt),
      Capacity.create(primitives.capacity),
      TicketPrice.create(primitives.priceCents, primitives.currency),
      EventStatus.create(primitives.status),
      primitives.createdAt,
      primitives.updatedAt,
      AggregateRoot.persistedVersion(primitives.version),
    );
  }

  /** RN-007: solo un evento programado y que no ha empezado puede cancelarse. */
  cancel(now: Date = new Date()): void {
    if (this._status.isCancelled()) {
      throw new EventAlreadyCancelledError(this._id.value);
    }
    if (this.hasStarted(now)) {
      throw new EventAlreadyStartedError(this._id.value);
    }
    this._status = EventStatus.cancelled();
    this._updatedAt = now;
    this.record(new EventCancelled(this._id.value, now));
  }

  hasStarted(now: Date = new Date()): boolean {
    return !this._startsAt.isAfter(now);
  }

  isCancelled(): boolean {
    return this._status.isCancelled();
  }

  get id(): EventId {
    return this._id;
  }

  get name(): EventName {
    return this._name;
  }

  get venue(): Venue {
    return this._venue;
  }

  get startsAt(): EventStart {
    return this._startsAt;
  }

  get capacity(): Capacity {
    return this._capacity;
  }

  get price(): TicketPrice {
    return this._price;
  }

  get status(): EventStatus {
    return this._status;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  toPrimitives(): EventPrimitives {
    return {
      id: this._id.value,
      name: this._name.value,
      venue: this._venue.value,
      startsAt: this._startsAt.value,
      capacity: this._capacity.value,
      priceCents: this._price.amountCents,
      currency: this._price.currency,
      status: this._status.value,
      createdAt: new Date(this._createdAt),
      updatedAt: new Date(this._updatedAt),
      version: this.version,
    };
  }

  private assertValidTimestamps(): void {
    const created = this._createdAt;
    const updated = this._updatedAt;
    if (
      !(created instanceof Date) ||
      !(updated instanceof Date) ||
      Number.isNaN(created.getTime()) ||
      Number.isNaN(updated.getTime()) ||
      updated.getTime() < created.getTime()
    ) {
      throw new EventInvariantViolationError('timestamps are invalid');
    }
  }
}
