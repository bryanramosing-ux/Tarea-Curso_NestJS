import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import {
  TicketAlreadyUsedError,
  TicketingInvariantViolationError,
  TicketRefundedError,
} from '../errors/ticketing.errors';
import { TicketCheckedIn } from '../events/ticket-checked-in.event';
import { TicketIssued } from '../events/ticket-issued.event';
import { TicketRefunded } from '../events/ticket-refunded.event';
import { EventReference } from '../value-objects/event-reference';
import { HolderEmail } from '../value-objects/holder-email';
import { HolderName } from '../value-objects/holder-name';
import { Money } from '../value-objects/money';
import { TicketCodeHash } from '../value-objects/ticket-code-hash';
import { TicketId } from '../value-objects/ticket-id';
import { TicketStatus } from '../value-objects/ticket-status';

export interface TicketPrimitives {
  id: string;
  eventId: string;
  holderName: string;
  holderEmail: string;
  codeHash: string;
  priceCents: number;
  currency: string;
  status: string;
  purchasedAt: Date;
  usedAt: Date | null;
  updatedAt: Date;
  version: number;
}

export interface IssueTicketProps {
  id: TicketId;
  eventId: EventReference;
  holderName: HolderName;
  holderEmail: HolderEmail;
  codeHash: TicketCodeHash;
  price: Money;
}

/**
 * Agregado Ticket (contexto Venta de entradas): una entrada concreta.
 *  - RN-012 solo conoce el HASH de su código secreto;
 *  - RN-013 se usa una sola vez; una entrada reembolsada no es válida;
 *  - RN-014 se reembolsa si el evento se cancela.
 */
export class Ticket extends AggregateRoot {
  private constructor(
    private readonly _id: TicketId,
    private readonly _eventId: EventReference,
    private readonly _holderName: HolderName,
    private readonly _holderEmail: HolderEmail,
    private readonly _codeHash: TicketCodeHash,
    private readonly _price: Money,
    private _status: TicketStatus,
    private readonly _purchasedAt: Date,
    private _usedAt: Date | null,
    private _updatedAt: Date,
    version: number,
  ) {
    super(version);
    this.assertInvariants();
  }

  static issue(props: IssueTicketProps, now: Date = new Date()): Ticket {
    const ticket = new Ticket(
      props.id,
      props.eventId,
      props.holderName,
      props.holderEmail,
      props.codeHash,
      props.price,
      TicketStatus.issued(),
      now,
      null,
      now,
      0,
    );
    ticket.record(new TicketIssued(ticket._id.value, ticket._eventId.value, now));
    return ticket;
  }

  static fromPrimitives(primitives: TicketPrimitives): Ticket {
    return new Ticket(
      TicketId.create(primitives.id),
      EventReference.create(primitives.eventId),
      HolderName.create(primitives.holderName),
      HolderEmail.create(primitives.holderEmail),
      TicketCodeHash.create(primitives.codeHash),
      Money.create(primitives.priceCents, primitives.currency),
      TicketStatus.create(primitives.status),
      primitives.purchasedAt,
      primitives.usedAt,
      primitives.updatedAt,
      AggregateRoot.persistedVersion(primitives.version),
    );
  }

  /** RN-013: registra la entrada en la puerta. Una entrada solo sirve una vez. */
  checkIn(now: Date = new Date()): void {
    if (this._status.isUsed()) {
      throw new TicketAlreadyUsedError(this._id.value);
    }
    if (this._status.isRefunded()) {
      throw new TicketRefundedError(this._id.value);
    }
    this._status = TicketStatus.used();
    this._usedAt = now;
    this._updatedAt = now;
    this.record(new TicketCheckedIn(this._id.value, this._eventId.value, now));
  }

  /** RN-014: reembolsa una entrada no usada (idempotente si ya estaba reembolsada). */
  refund(now: Date = new Date()): void {
    if (this._status.isRefunded()) {
      return;
    }
    if (this._status.isUsed()) {
      throw new TicketAlreadyUsedError(this._id.value);
    }
    this._status = TicketStatus.refunded();
    this._updatedAt = now;
    this.record(new TicketRefunded(this._id.value, this._eventId.value, this._price.amountCents, this._price.currency, now));
  }

  get id(): TicketId {
    return this._id;
  }

  get eventId(): EventReference {
    return this._eventId;
  }

  get holderName(): HolderName {
    return this._holderName;
  }

  get holderEmail(): HolderEmail {
    return this._holderEmail;
  }

  get price(): Money {
    return this._price;
  }

  get status(): TicketStatus {
    return this._status;
  }

  get purchasedAt(): Date {
    return new Date(this._purchasedAt);
  }

  get usedAt(): Date | null {
    return this._usedAt ? new Date(this._usedAt) : null;
  }

  toPrimitives(): TicketPrimitives {
    return {
      id: this._id.value,
      eventId: this._eventId.value,
      holderName: this._holderName.value,
      holderEmail: this._holderEmail.value,
      codeHash: this._codeHash.value,
      priceCents: this._price.amountCents,
      currency: this._price.currency,
      status: this._status.value,
      purchasedAt: new Date(this._purchasedAt),
      usedAt: this._usedAt ? new Date(this._usedAt) : null,
      updatedAt: new Date(this._updatedAt),
      version: this.version,
    };
  }

  private assertInvariants(): void {
    const isValidDate = (date: unknown): date is Date => date instanceof Date && !Number.isNaN(date.getTime());
    if (!isValidDate(this._purchasedAt) || !isValidDate(this._updatedAt)) {
      throw new TicketingInvariantViolationError('ticket dates are invalid');
    }
    if (this._updatedAt.getTime() < this._purchasedAt.getTime()) {
      throw new TicketingInvariantViolationError('ticket timestamps are invalid');
    }
    const hasUsedAt = this._usedAt !== null;
    if (this._status.isUsed() !== hasUsedAt) {
      throw new TicketingInvariantViolationError('only a USED ticket has a check-in date');
    }
    if (hasUsedAt && (!isValidDate(this._usedAt) || this._usedAt.getTime() < this._purchasedAt.getTime())) {
      throw new TicketingInvariantViolationError('check-in date is invalid');
    }
  }
}
