import { InvalidMoneyError } from '../errors/ticketing.errors';

const MAX_AMOUNT_CENTS = 1_000_000_000;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/**
 * Dinero en céntimos (entero) y moneda ISO 4217. Inmutable: las operaciones
 * devuelven un Money nuevo. Propio del contexto de venta (no se comparte con
 * el TicketPrice del catálogo).
 */
export class Money {
  private constructor(
    public readonly amountCents: number,
    public readonly currency: string,
  ) {}

  static create(amountCents: number, currency: string): Money {
    const normalizedCurrency = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
    if (
      typeof amountCents !== 'number' ||
      !Number.isInteger(amountCents) ||
      amountCents < 0 ||
      amountCents > MAX_AMOUNT_CENTS ||
      !CURRENCY_PATTERN.test(normalizedCurrency)
    ) {
      throw new InvalidMoneyError();
    }
    return new Money(amountCents, normalizedCurrency);
  }

  /** RN-015: total = precio unitario × cantidad. */
  times(factor: number): Money {
    return Money.create(this.amountCents * factor, this.currency);
  }

  equals(other: Money): boolean {
    return other instanceof Money && this.amountCents === other.amountCents && this.currency === other.currency;
  }

  toString(): string {
    return `${(this.amountCents / 100).toFixed(2)} ${this.currency}`;
  }
}
