import { DomainErrorKind } from '../../../shared/domain/domain-exception';
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
import { TicketAllocation, TicketAllocationPrimitives } from './ticket-allocation';

const NOW = new Date('2027-01-10T10:00:00.000Z');
const STARTS = new Date('2027-03-20T21:00:00.000Z');
const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');
const q = (value: number) => Quantity.create(value);

function saleable(overrides: Partial<{ capacity: number; onSale: boolean }> = {}): SaleableEvent {
  return SaleableEvent.create({
    id: EVENT,
    capacity: overrides.capacity ?? 5,
    startsAt: STARTS,
    unitPrice: Money.create(4500, 'PEN'),
    onSale: overrides.onSale ?? true,
  });
}

describe('TicketAllocation aggregate', () => {
  describe('open (RN-010)', () => {
    it('opens sales for an event on sale, with nothing sold and version 0', () => {
      const allocation = TicketAllocation.open(saleable(), NOW);
      expect(allocation).toMatchObject({ capacity: 5, sold: 0, available: 5, version: 0 });
      expect(allocation.acceptsSales(NOW)).toBe(true);
    });

    it('refuses to open sales for an event that is not on sale (cancelled)', () => {
      expect(() => TicketAllocation.open(saleable({ onSale: false }), NOW)).toThrow(SalesClosedError);
    });
  });

  describe('sell (RN-009, RN-010, RN-015)', () => {
    it('reserves seats, returns the total and records TicketsSold', () => {
      const allocation = TicketAllocation.open(saleable(), NOW);

      const total = allocation.sell(q(2), NOW);

      expect(total.equals(Money.create(9000, 'PEN'))).toBe(true);
      expect(allocation).toMatchObject({ sold: 2, available: 3 });
      expect(allocation.pullDomainEvents()).toEqual([new TicketsSold(EVENT.value, 2, 3, NOW)]);
    });

    it('records EventSoldOut when the last seat is sold', () => {
      const allocation = TicketAllocation.open(saleable({ capacity: 2 }), NOW);
      allocation.sell(q(2), NOW);
      expect(allocation.pullDomainEvents()).toEqual([
        new TicketsSold(EVENT.value, 2, 0, NOW),
        new EventSoldOut(EVENT.value, NOW),
      ]);
    });

    it('never sells more than the capacity', () => {
      const allocation = TicketAllocation.open(saleable({ capacity: 3 }), NOW);
      allocation.sell(q(2), NOW);
      expect(() => allocation.sell(q(2), NOW)).toThrow(NotEnoughTicketsError);
      expect(() => allocation.sell(q(2), NOW)).toThrow(
        expect.objectContaining({ code: 'TICKET_NOT_ENOUGH_AVAILABLE', kind: DomainErrorKind.CONFLICT }),
      );
      expect(allocation.sold).toBe(2);
    });

    it('does not sell once the event has started', () => {
      const allocation = TicketAllocation.open(saleable(), NOW);
      expect(() => allocation.sell(q(1), STARTS)).toThrow(EventAlreadyStartedError);
      expect(allocation.acceptsSales(STARTS)).toBe(false);
    });

    it('does not sell when sales are closed', () => {
      const allocation = TicketAllocation.open(saleable(), NOW);
      allocation.close(NOW);
      expect(() => allocation.sell(q(1), NOW)).toThrow(SalesClosedError);
    });
  });

  describe('close (RN-014)', () => {
    it('closes once and records SalesClosed; closing again changes nothing', () => {
      const allocation = TicketAllocation.open(saleable(), NOW);
      allocation.close(NOW);
      allocation.close(NOW);
      expect(allocation.status.value).toBe('CLOSED');
      expect(allocation.pullDomainEvents()).toEqual([new SalesClosed(EVENT.value, NOW)]);
    });
  });

  describe('toPrimitives / fromPrimitives', () => {
    const storedRow = (): TicketAllocationPrimitives => {
      const allocation = TicketAllocation.open(saleable(), NOW);
      allocation.sell(q(2), NOW);
      return { ...allocation.toPrimitives(), version: 4 };
    };

    it('round-trips without emitting events', () => {
      const row = storedRow();
      const restored = TicketAllocation.fromPrimitives(row);
      expect(restored.toPrimitives()).toEqual(row);
      expect(restored.pullDomainEvents()).toEqual([]);
    });

    it('refuses rows that break the invariants', () => {
      const row = storedRow();
      expect(() => TicketAllocation.fromPrimitives({ ...row, sold: 6 })).toThrow(TicketingInvariantViolationError);
      expect(() => TicketAllocation.fromPrimitives({ ...row, sold: -1 })).toThrow(TicketingInvariantViolationError);
      expect(() => TicketAllocation.fromPrimitives({ ...row, capacity: 0, sold: 0 })).toThrow(
        TicketingInvariantViolationError,
      );
      expect(() => TicketAllocation.fromPrimitives({ ...row, version: 0 })).toThrow(
        expect.objectContaining({ code: 'INVALID_AGGREGATE_VERSION' }),
      );
    });
  });
});
