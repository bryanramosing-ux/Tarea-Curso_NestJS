import { InvalidSalesStatusError } from '../errors/ticketing.errors';

export const SalesStatusValue = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;

export type SalesStatusValue = (typeof SalesStatusValue)[keyof typeof SalesStatusValue];

const VALID_VALUES: readonly string[] = Object.values(SalesStatusValue);

/** Estado de la venta de entradas de un evento. */
export class SalesStatus {
  private constructor(public readonly value: SalesStatusValue) {}

  static create(value: string): SalesStatus {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!VALID_VALUES.includes(normalized)) {
      throw new InvalidSalesStatusError(String(value));
    }
    return new SalesStatus(normalized as SalesStatusValue);
  }

  static open(): SalesStatus {
    return new SalesStatus(SalesStatusValue.OPEN);
  }

  static closed(): SalesStatus {
    return new SalesStatus(SalesStatusValue.CLOSED);
  }

  isOpen(): boolean {
    return this.value === SalesStatusValue.OPEN;
  }

  equals(other: SalesStatus): boolean {
    return other instanceof SalesStatus && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
