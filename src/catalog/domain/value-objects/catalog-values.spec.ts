import { DomainErrorKind } from '../../../shared/domain/domain-exception';
import {
  InvalidCapacityError,
  InvalidEventIdError,
  InvalidEventNameError,
  InvalidEventStartError,
  InvalidEventStatusError,
  InvalidTicketPriceError,
  InvalidVenueError,
} from '../errors/event.errors';
import { Capacity } from './capacity';
import { EventId } from './event-id';
import { EventName } from './event-name';
import { EventStart } from './event-start';
import { EventStatus } from './event-status';
import { TicketPrice } from './ticket-price';
import { Venue } from './venue';

describe('EventName (RN-001)', () => {
  it('trims and collapses whitespace', () => {
    expect(EventName.create('  Rock   en el   Parque ').value).toBe('Rock en el Parque');
  });

  it.each(['', '  ', 'ab', 'x'.repeat(121)])('rejects %p', (value) => {
    expect(() => EventName.create(value)).toThrow(InvalidEventNameError);
  });

  it('accepts the boundaries and compares by value', () => {
    expect(EventName.create('abc').equals(EventName.create(' abc '))).toBe(true);
    expect(EventName.create('x'.repeat(120)).value).toHaveLength(120);
  });

  it('raises a VALIDATION error with a stable code', () => {
    expect(() => EventName.create('a')).toThrow(
      expect.objectContaining({ code: 'EVENT_INVALID_NAME', kind: DomainErrorKind.VALIDATION }),
    );
  });
});

describe('Venue (RN-002)', () => {
  it('keeps the display casing but compares case-insensitively', () => {
    const venue = Venue.create('  Estadio   Nacional ');
    expect(venue.value).toBe('Estadio Nacional');
    expect(venue.key).toBe('estadio nacional');
    expect(venue.equals(Venue.create('ESTADIO NACIONAL'))).toBe(true);
    expect(venue.equals(Venue.create('Arena Lima'))).toBe(false);
  });

  it.each(['', 'A', 'x'.repeat(121)])('rejects %p', (value) => {
    expect(() => Venue.create(value)).toThrow(InvalidVenueError);
  });
});

describe('EventStart', () => {
  it('parses ISO strings and drops milliseconds', () => {
    expect(EventStart.create('2027-03-20T21:00:00.789Z').value.toISOString()).toBe('2027-03-20T21:00:00.000Z');
  });

  it('compares instants regardless of the input format', () => {
    expect(EventStart.create('2027-03-20T16:00:00-05:00').equals(EventStart.create('2027-03-20T21:00:00Z'))).toBe(true);
  });

  it('knows whether it is after a moment', () => {
    const start = EventStart.create('2027-03-20T21:00:00Z');
    expect(start.isAfter(new Date('2027-03-20T20:59:59Z'))).toBe(true);
    expect(start.isAfter(new Date('2027-03-20T21:00:00Z'))).toBe(false);
  });

  it.each(['', 'mañana', '2027-13-45', '2027-03-20T21:00:00', '2027-03-20'])('rejects %p', (value) => {
    expect(() => EventStart.create(value)).toThrow(InvalidEventStartError);
  });

  it('does not share the internal date (immutable)', () => {
    const start = EventStart.create('2027-03-20T21:00:00Z');
    start.value.setUTCFullYear(2000);
    expect(start.value.getUTCFullYear()).toBe(2027);
  });
});

describe('Capacity (RN-004)', () => {
  it('accepts integers between 1 and 100000', () => {
    expect(Capacity.create(1).value).toBe(1);
    expect(Capacity.create(100_000).equals(Capacity.create(100_000))).toBe(true);
  });

  it.each([0, -5, 100_001, 2.5, Number.NaN])('rejects %p', (value) => {
    expect(() => Capacity.create(value)).toThrow(InvalidCapacityError);
  });
});

describe('TicketPrice (RN-005)', () => {
  it('stores integer cents and normalizes the currency', () => {
    const price = TicketPrice.create(4500, ' pen ');
    expect(price).toMatchObject({ amountCents: 4500, currency: 'PEN' });
    expect(price.toString()).toBe('45.00 PEN');
    expect(price.equals(TicketPrice.create(4500, 'PEN'))).toBe(true);
    expect(price.equals(TicketPrice.create(4500, 'USD'))).toBe(false);
  });

  it('allows free events', () => {
    expect(TicketPrice.create(0, 'USD').isFree()).toBe(true);
  });

  it.each([
    [-1, 'PEN'],
    [10.5, 'PEN'],
    [10_000_001, 'PEN'],
    [100, 'BTC'],
    [100, ''],
  ])('rejects %p %p', (amount, currency) => {
    expect(() => TicketPrice.create(amount, currency)).toThrow(InvalidTicketPriceError);
  });
});

describe('EventStatus / EventId', () => {
  it('knows its statuses', () => {
    expect(EventStatus.create('scheduled').equals(EventStatus.scheduled())).toBe(true);
    expect(EventStatus.cancelled().isCancelled()).toBe(true);
    expect(() => EventStatus.create('POSTPONED')).toThrow(InvalidEventStatusError);
  });

  it('validates and normalizes ids', () => {
    const id = EventId.generate();
    expect(EventId.create(id.value.toUpperCase()).equals(id)).toBe(true);
    expect(() => EventId.create('nope')).toThrow(InvalidEventIdError);
  });
});
