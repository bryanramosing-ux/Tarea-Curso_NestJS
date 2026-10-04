import {
  InvalidEventReferenceError,
  InvalidHolderEmailError,
  InvalidHolderNameError,
  InvalidMoneyError,
  InvalidQuantityError,
  InvalidSaleableEventError,
  InvalidSalesStatusError,
  InvalidTicketCodeError,
  InvalidTicketCodeHashError,
  InvalidTicketIdError,
  InvalidTicketStatusError,
} from '../errors/ticketing.errors';
import { EventReference } from './event-reference';
import { HolderEmail } from './holder-email';
import { HolderName } from './holder-name';
import { Money } from './money';
import { Quantity } from './quantity';
import { SaleableEvent } from './saleable-event';
import { SalesStatus } from './sales-status';
import { TicketCode } from './ticket-code';
import { TicketCodeHash } from './ticket-code-hash';
import { TicketId } from './ticket-id';
import { TicketStatus } from './ticket-status';

const EVENT = EventReference.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');

describe('Quantity (RN-008)', () => {
  it('accepts 1 to 10 tickets', () => {
    expect(Quantity.create(1).value).toBe(1);
    expect(Quantity.create(10).equals(Quantity.create(10))).toBe(true);
  });

  it.each([0, 11, -1, 1.5, Number.NaN])('rejects %p', (value) => {
    expect(() => Quantity.create(value)).toThrow(InvalidQuantityError);
  });
});

describe('Money (RN-015)', () => {
  it('multiplies without floating point errors and keeps the currency', () => {
    const total = Money.create(1999, 'usd').times(3);
    expect(total).toMatchObject({ amountCents: 5997, currency: 'USD' });
    expect(total.toString()).toBe('59.97 USD');
  });

  it('compares amount and currency', () => {
    expect(Money.create(100, 'PEN').equals(Money.create(100, 'PEN'))).toBe(true);
    expect(Money.create(100, 'PEN').equals(Money.create(100, 'USD'))).toBe(false);
  });

  it.each([
    [-1, 'PEN'],
    [1.5, 'PEN'],
    [100, 'soles'],
  ])('rejects %p %p', (amount, currency) => {
    expect(() => Money.create(amount, currency)).toThrow(InvalidMoneyError);
  });
});

describe('Holder (RN-011)', () => {
  it('normalizes name and email', () => {
    expect(HolderName.create('  Ana   Pérez ').value).toBe('Ana Pérez');
    expect(HolderEmail.create(' ANA@Mail.COM ').value).toBe('ana@mail.com');
    expect(HolderEmail.create('a@b.io').equals(HolderEmail.create('A@B.IO'))).toBe(true);
  });

  it.each(['', 'A', 'x'.repeat(81)])('rejects the name %p', (value) => {
    expect(() => HolderName.create(value)).toThrow(InvalidHolderNameError);
  });

  it.each(['', 'ana', 'ana@', 'ana perez@mail.com', `${'a'.repeat(250)}@x.io`])('rejects the email %p', (value) => {
    expect(() => HolderEmail.create(value)).toThrow(InvalidHolderEmailError);
  });
});

describe('TicketCode (RN-012)', () => {
  it('generates unambiguous XXXX-XXXX-XXXX codes', () => {
    const codes = Array.from({ length: 200 }, () => TicketCode.generate().reveal());
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(code).not.toMatch(/[01OIL]/);
    }
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('accepts lowercase input and compares by value', () => {
    expect(TicketCode.create(' abcd-efgh-jkmn ').equals(TicketCode.create('ABCD-EFGH-JKMN'))).toBe(true);
  });

  it.each(['', 'ABCD', 'ABCD-EFGH-IJKL', 'ABCDEFGHJKMN', 'ABCD-EFGH-JKMN-PQRS'])('rejects %p', (value) => {
    expect(() => TicketCode.create(value)).toThrow(InvalidTicketCodeError);
  });

  it('never leaks the secret through toString, JSON or template strings', () => {
    const code = TicketCode.create('ABCD-EFGH-JKMN');
    expect(String(code)).toBe('[REDACTED]');
    expect(`${code}`).toBe('[REDACTED]');
    expect(JSON.stringify({ code })).toBe('{"code":"[REDACTED]"}');
  });

  it('does not include the rejected value in the error message', () => {
    expect(() => TicketCode.create('SECRET-GUESS')).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('SECRET-GUESS') }),
    );
  });
});

describe('TicketCodeHash / statuses / ids', () => {
  it('validates the hash format', () => {
    expect(TicketCodeHash.create('A'.repeat(64)).value).toBe('a'.repeat(64));
    expect(() => TicketCodeHash.create('zz')).toThrow(InvalidTicketCodeHashError);
  });

  it('knows ticket and sales statuses', () => {
    expect(TicketStatus.create('issued').isIssued()).toBe(true);
    expect(TicketStatus.used().equals(TicketStatus.create('USED'))).toBe(true);
    expect(() => TicketStatus.create('LOST')).toThrow(InvalidTicketStatusError);
    expect(SalesStatus.open().isOpen()).toBe(true);
    expect(() => SalesStatus.create('PAUSED')).toThrow(InvalidSalesStatusError);
  });

  it('validates ids', () => {
    expect(() => TicketId.create('nope')).toThrow(InvalidTicketIdError);
    expect(() => EventReference.create('nope')).toThrow(InvalidEventReferenceError);
    const id = TicketId.generate();
    expect(TicketId.create(id.value).equals(id)).toBe(true);
  });
});

describe('SaleableEvent', () => {
  const props = { id: EVENT, capacity: 100, startsAt: new Date('2027-03-20T21:00:00Z'), unitPrice: Money.create(4500, 'PEN'), onSale: true };

  it('exposes what the sales context needs', () => {
    const event = SaleableEvent.create(props);
    expect(event.isOnSale()).toBe(true);
    expect(event.equals(SaleableEvent.create(props))).toBe(true);
    expect(event.equals(SaleableEvent.create({ ...props, onSale: false }))).toBe(false);
  });

  it('rejects unusable data coming from the catalog', () => {
    expect(() => SaleableEvent.create({ ...props, capacity: 0 })).toThrow(InvalidSaleableEventError);
    expect(() => SaleableEvent.create({ ...props, startsAt: new Date('nope') })).toThrow(InvalidSaleableEventError);
  });
});
