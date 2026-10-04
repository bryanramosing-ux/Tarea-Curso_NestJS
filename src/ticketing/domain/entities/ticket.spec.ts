import { DomainErrorKind } from '../../../shared/domain/domain-exception';
import { TicketAlreadyUsedError, TicketingInvariantViolationError, TicketRefundedError } from '../errors/ticketing.errors';
import { TicketCheckedIn } from '../events/ticket-checked-in.event';
import { TicketIssued } from '../events/ticket-issued.event';
import { TicketRefunded } from '../events/ticket-refunded.event';
import { EventReference } from '../value-objects/event-reference';
import { HolderEmail } from '../value-objects/holder-email';
import { HolderName } from '../value-objects/holder-name';
import { Money } from '../value-objects/money';
import { TicketCodeHash } from '../value-objects/ticket-code-hash';
import { TicketId } from '../value-objects/ticket-id';
import { Ticket, TicketPrimitives } from './ticket';

const NOW = new Date('2027-01-10T10:00:00.000Z');
const DOORS = new Date('2027-03-20T20:00:00.000Z');
const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');

function issueTicket(): Ticket {
  const ticket = Ticket.issue(
    {
      id: TicketId.generate(),
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

  describe('checkIn (RN-013)', () => {
    it('lets the holder in once and records TicketCheckedIn', () => {
      const ticket = issueTicket();
      ticket.pullDomainEvents();

      ticket.checkIn(DOORS);

      expect(ticket.status.value).toBe('USED');
      expect(ticket.usedAt).toEqual(DOORS);
      expect(ticket.pullDomainEvents()).toEqual([new TicketCheckedIn(ticket.id.value, EVENT.value, DOORS)]);
    });

    it('refuses a second check-in (CONFLICT)', () => {
      const ticket = issueTicket();
      ticket.checkIn(DOORS);
      expect(() => ticket.checkIn(DOORS)).toThrow(
        expect.objectContaining({ code: 'TICKET_ALREADY_USED', kind: DomainErrorKind.CONFLICT }),
      );
    });

    it('refuses a refunded ticket', () => {
      const ticket = issueTicket();
      ticket.refund(NOW);
      expect(() => ticket.checkIn(DOORS)).toThrow(TicketRefundedError);
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
      ticket.checkIn(DOORS);
      expect(() => ticket.refund(DOORS)).toThrow(TicketAlreadyUsedError);
    });
  });

  describe('toPrimitives / fromPrimitives', () => {
    const storedRow = (): TicketPrimitives => {
      const ticket = issueTicket();
      ticket.checkIn(DOORS);
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
