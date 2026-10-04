import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import {
  EventAlreadyStartedError,
  NotEnoughTicketsError,
  SalesClosedError,
  TicketingInvariantViolationError,
} from '../errors/ticketing.errors';
import { EventSoldOut } from '../events/event-sold-out.event';
import { SalesClosed } from '../events/sales-closed.event';
import { TicketsSold } from '../events/tickets-sold.event';
import { EventReference } from '../value-objects/event-reference';
import { Money } from '../value-objects/money';
import { Quantity } from '../value-objects/quantity';
import { SaleableEvent } from '../value-objects/saleable-event';
import { SalesStatus } from '../value-objects/sales-status';

export interface TicketAllocationPrimitives {
  eventId: string;
  capacity: number;
  sold: number;
  priceCents: number;
  currency: string;
  startsAt: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Agregado TicketAllocation (contexto Venta de entradas): el cupo de entradas
 * de UN evento. Es el guardián del aforo:
 *  - RN-009 nunca se venden más entradas que el aforo (también ante compras
 *    simultáneas, gracias al bloqueo optimista de su versión);
 *  - RN-010 no se vende si la venta está cerrada o el evento ya empezó;
 *  - RN-015 el total es precio unitario × cantidad.
 */
export class TicketAllocation extends AggregateRoot {
  private constructor(
    private readonly _eventId: EventReference,
    private readonly _capacity: number,
    private _sold: number,
    private readonly _unitPrice: Money,
    private readonly _startsAt: Date,
    private _status: SalesStatus,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    version: number,
  ) {
    super(version);
    this.assertInvariants();
  }

  /** Abre la venta de un evento del catálogo (RN-010: debe estar a la venta). */
  static open(event: SaleableEvent, now: Date = new Date()): TicketAllocation {
    if (!event.isOnSale()) {
      throw new SalesClosedError(event.id.value);
    }
    return new TicketAllocation(event.id, event.capacity, 0, event.unitPrice, event.startsAt, SalesStatus.open(), now, now, 0);
  }

  static fromPrimitives(primitives: TicketAllocationPrimitives): TicketAllocation {
    return new TicketAllocation(
      EventReference.create(primitives.eventId),
      primitives.capacity,
      primitives.sold,
      Money.create(primitives.priceCents, primitives.currency),
      primitives.startsAt,
      SalesStatus.create(primitives.status),
      primitives.createdAt,
      primitives.updatedAt,
      AggregateRoot.persistedVersion(primitives.version),
    );
  }

  /** RN-009 + RN-010 + RN-015. Devuelve el total a cobrar. */
  sell(quantity: Quantity, now: Date = new Date()): Money {
    if (!this._status.isOpen()) {
      throw new SalesClosedError(this._eventId.value);
    }
    if (this._startsAt.getTime() <= now.getTime()) {
      throw new EventAlreadyStartedError(this._eventId.value);
    }
    if (quantity.value > this.available) {
      throw new NotEnoughTicketsError(quantity.value, this.available);
    }
    this._sold += quantity.value;
    this._updatedAt = now;
    this.record(new TicketsSold(this._eventId.value, quantity.value, this.available, now));
    if (this.available === 0) {
      this.record(new EventSoldOut(this._eventId.value, now));
    }
    return this._unitPrice.times(quantity.value);
  }

  /** RN-014: cierra la venta (idempotente). */
  close(now: Date = new Date()): void {
    if (!this._status.isOpen()) {
      return;
    }
    this._status = SalesStatus.closed();
    this._updatedAt = now;
    this.record(new SalesClosed(this._eventId.value, now));
  }

  /** La venta está abierta y el evento aún no ha empezado (puede estar agotado). */
  acceptsSales(now: Date = new Date()): boolean {
    return this._status.isOpen() && this._startsAt.getTime() > now.getTime();
  }

  get available(): number {
    return this._capacity - this._sold;
  }

  get eventId(): EventReference {
    return this._eventId;
  }

  get capacity(): number {
    return this._capacity;
  }

  get sold(): number {
    return this._sold;
  }

  get unitPrice(): Money {
    return this._unitPrice;
  }

  get status(): SalesStatus {
    return this._status;
  }

  toPrimitives(): TicketAllocationPrimitives {
    return {
      eventId: this._eventId.value,
      capacity: this._capacity,
      sold: this._sold,
      priceCents: this._unitPrice.amountCents,
      currency: this._unitPrice.currency,
      startsAt: new Date(this._startsAt),
      status: this._status.value,
      createdAt: new Date(this._createdAt),
      updatedAt: new Date(this._updatedAt),
      version: this.version,
    };
  }

  private assertInvariants(): void {
    if (!Number.isInteger(this._capacity) || this._capacity < 1) {
      throw new TicketingInvariantViolationError('capacity must be a positive integer');
    }
    if (!Number.isInteger(this._sold) || this._sold < 0 || this._sold > this._capacity) {
      throw new TicketingInvariantViolationError('sold tickets must be between 0 and the capacity');
    }
    const dates = [this._startsAt, this._createdAt, this._updatedAt];
    if (dates.some((date) => !(date instanceof Date) || Number.isNaN(date.getTime()))) {
      throw new TicketingInvariantViolationError('dates are invalid');
    }
    if (this._updatedAt.getTime() < this._createdAt.getTime()) {
      throw new TicketingInvariantViolationError('timestamps are invalid');
    }
  }
}
