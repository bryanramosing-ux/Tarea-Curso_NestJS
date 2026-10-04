import { InvalidTicketPriceError } from '../errors/event.errors';

export const SUPPORTED_CURRENCIES = ['PEN', 'USD', 'EUR'] as const;
const MAX_AMOUNT_CENTS = 10_000_000;

/**
 * RN-005: precio de la entrada en céntimos (entero, sin decimales flotantes:
 * 0,1 + 0,2 ≠ 0,3 en coma flotante) y una moneda soportada. 0 = evento gratuito.
 */
export class TicketPrice {
  private constructor(
    public readonly amountCents: number,
    public readonly currency: string,
  ) {}

  static create(amountCents: number, currency: string): TicketPrice {
    const normalizedCurrency = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
    if (
      typeof amountCents !== 'number' ||
      !Number.isInteger(amountCents) ||
      amountCents < 0 ||
      amountCents > MAX_AMOUNT_CENTS ||
      !(SUPPORTED_CURRENCIES as readonly string[]).includes(normalizedCurrency)
    ) {
      throw new InvalidTicketPriceError();
    }
    return new TicketPrice(amountCents, normalizedCurrency);
  }

  isFree(): boolean {
    return this.amountCents === 0;
  }

  equals(other: TicketPrice): boolean {
    return other instanceof TicketPrice && this.amountCents === other.amountCents && this.currency === other.currency;
  }

  toString(): string {
    return `${(this.amountCents / 100).toFixed(2)} ${this.currency}`;
  }
}
