import { randomUUID } from 'node:crypto';
import { DomainErrorKind } from '../../../shared/domain/domain-exception';
import {
  CheckInClosedError,
  CheckInNotOpenError,
  TicketAlreadyUsedError,
  TicketEventCancelledError,
  TicketForAnotherEventError,
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
import { SaleableEvent } from '../value-objects/saleable-event';
import { TicketCodeHash } from '../value-objects/ticket-code-hash';
import { TicketId } from '../value-objects/ticket-id';
import { Ticket, TicketPrimitives } from './ticket';

const NOW = new Date('2027-01-10T10:00:00.000Z');
const DOORS = new Date('2027-03-20T20:00:00.000Z');
const STARTS = new Date('2027-03-20T21:00:00.000Z');
const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');
const OTHER_EVENT = EventReference.create('0f8fad5b-d9cb-469f-a165-70867728950e');
const HOUR = 3_600_000;

function catalogEvent(overrides: Partial<{ id: EventReference; onSale: boolean }> = {}): SaleableEvent {
  return SaleableEvent.create({
    id: overrides.id ?? EVENT,
    capacity: 100,
    startsAt: STARTS,
    unitPrice: Money.create(4500, 'PEN'),
    onSale: overrides.onSale ?? true,
  });
}
const EVENT_ON = catalogEvent();

function issueTicket(): Ticket {
  const ticket = Ticket.issue(
    {
      id: TicketId.create(randomUUID()),
      eventId: EVENT,
      holderName: HolderName.create('Ana Pérez'),
      holderEmail: HolderEmail.create('ana@mail.com'),
      codeHash: TicketCodeHash.create('a'.repeat(64)),
      price: Money.create(4500, 'PEN'),
    },
    NOW,
  );
  return ticket;
}

describe('Ticket aggregate', () => {
  it('is issued valid and records TicketIssued without the code or personal data', () => {
    const ticket = issueTicket();
    expect(ticket.status.value).toBe('ISSUED');
    const events = ticket.pullDomainEvents();
    expect(events).toEqual([new TicketIssued(ticket.id.value, EVENT.value, NOW)]);
    expect(JSON.stringify(events)).not.toMatch(/aaaa|ana@mail/);
  });

  describe('checkIn (RN-013, RN-016)', () => {
    it('lets the holder in once and records TicketCheckedIn', () => {
      const ticket = issueTicket();
      ticket.pullDomainEvents();

      ticket.checkIn(EVENT_ON, DOORS);

      expect(ticket.status.value).toBe('USED');
      expect(ticket.usedAt).toEqual(DOORS);
      expect(ticket.pullDomainEvents()).toEqual([new TicketCheckedIn(ticket.id.value, EVENT.value, DOORS)]);
    });

    it('refuses a second check-in (CONFLICT)', () => {
      const ticket = issueTicket();
      ticket.checkIn(EVENT_ON, DOORS);
      expect(() => ticket.checkIn(EVENT_ON, DOORS)).toThrow(
        expect.objectContaining({ code: 'TICKET_ALREADY_USED', kind: DomainErrorKind.CONFLICT }),
      );
    });

    it('refuses a refunded ticket', () => {
      const ticket = issueTicket();
      ticket.refund(NOW);
      expect(() => ticket.checkIn(EVENT_ON, DOORS)).toThrow(TicketRefundedError);
    });

    it('refuses a ticket of another event, even if it is valid (RN-016)', () => {
      const ticket = issueTicket();
      expect(() => ticket.checkIn(catalogEvent({ id: OTHER_EVENT }), DOORS)).toThrow(TicketForAnotherEventError);
      expect(ticket.status.value).toBe('ISSUED');
    });

    it('refuses a ticket whose event was cancelled, even before the refund happens (RN-016)', () => {
      const ticket = issueTicket();
      expect(() => ticket.checkIn(catalogEvent({ onSale: false }), DOORS)).toThrow(TicketEventCancelledError);
      expect(ticket.status.value).toBe('ISSUED');
    });

    it('only admits from 12 h before the start until 24 h after it (RN-016)', () => {
      const opens = new Date(STARTS.getTime() - 12 * HOUR);
      const closes = new Date(STARTS.getTime() + 24 * HOUR);

      expect(() => issueTicket().checkIn(EVENT_ON, new Date(opens.getTime() - 1000))).toThrow(CheckInNotOpenError);
      expect(() => issueTicket().checkIn(EVENT_ON, new Date(closes.getTime() + 1000))).toThrow(CheckInClosedError);
      expect(() => issueTicket().checkIn(EVENT_ON, new Date(closes.getTime() + 1000))).toThrow(
        expect.objectContaining({ code: 'TICKET_CHECK_IN_CLOSED', kind: DomainErrorKind.CONFLICT }),
      );
      expect(() => issueTicket().checkIn(EVENT_ON, opens)).not.toThrow();
      expect(() => issueTicket().checkIn(EVENT_ON, closes)).not.toThrow();
    });
  });

  describe('refund (RN-014)', () => {
    it('refunds an unused ticket and records the amount', () => {
      const ticket = issueTicket();
      ticket.pullDomainEvents();
      ticket.refund(DOORS);
      expect(ticket.status.value).toBe('REFUNDED');
      expect(ticket.pullDomainEvents()).toEqual([new TicketRefunded(ticket.id.value, EVENT.value, 4500, 'PEN', DOORS)]);
    });

    it('is idempotent for an already refunded ticket', () => {
      const ticket = issueTicket();
      ticket.refund(NOW);
      ticket.pullDomainEvents();
      ticket.refund(NOW);
      expect(ticket.pullDomainEvents()).toEqual([]);
    });

    it('refuses to refund a used ticket', () => {
      const ticket = issueTicket();
      ticket.checkIn(EVENT_ON, DOORS);
      expect(() => ticket.refund(DOORS)).toThrow(TicketAlreadyUsedError);
    });
  });

  describe('toPrimitives / fromPrimitives', () => {
    const storedRow = (): TicketPrimitives => {
      const ticket = issueTicket();
      ticket.checkIn(EVENT_ON, DOORS);
      return { ...ticket.toPrimitives(), version: 2 };
    };

    it('round-trips without emitting events', () => {
      const row = storedRow();
      const restored = Ticket.fromPrimitives(row);
      expect(restored.toPrimitives()).toEqual(row);
      expect(restored.pullDomainEvents()).toEqual([]);
    });

    it('refuses rows that break the invariants', () => {
      const row = storedRow();
      expect(() => Ticket.fromPrimitives({ ...row, usedAt: null })).toThrow(TicketingInvariantViolationError);
      expect(() => Ticket.fromPrimitives({ ...row, status: 'ISSUED' })).toThrow(TicketingInvariantViolationError);
      expect(() => Ticket.fromPrimitives({ ...row, usedAt: new Date('2020-01-01') })).toThrow(
        TicketingInvariantViolationError,
      );
    });
  });
});
