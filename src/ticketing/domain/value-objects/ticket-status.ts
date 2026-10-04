import { InvalidTicketStatusError } from '../errors/ticketing.errors';

export const TicketStatusValue = {
  ISSUED: 'ISSUED',
  USED: 'USED',
  REFUNDED: 'REFUNDED',
} as const;

export type TicketStatusValue = (typeof TicketStatusValue)[keyof typeof TicketStatusValue];

const VALID_VALUES: readonly string[] = Object.values(TicketStatusValue);

/** RN-013: ISSUED (válida) → USED (ya entró) | REFUNDED (reembolsada). */
export class TicketStatus {
  private constructor(public readonly value: TicketStatusValue) {}

  static create(value: string): TicketStatus {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!VALID_VALUES.includes(normalized)) {
      throw new InvalidTicketStatusError(String(value));
    }
    return new TicketStatus(normalized as TicketStatusValue);
  }

  static issued(): TicketStatus {
    return new TicketStatus(TicketStatusValue.ISSUED);
  }

  static used(): TicketStatus {
    return new TicketStatus(TicketStatusValue.USED);
  }

  static refunded(): TicketStatus {
    return new TicketStatus(TicketStatusValue.REFUNDED);
  }

  isIssued(): boolean {
    return this.value === TicketStatusValue.ISSUED;
  }

  isUsed(): boolean {
    return this.value === TicketStatusValue.USED;
  }

  isRefunded(): boolean {
    return this.value === TicketStatusValue.REFUNDED;
  }

  equals(other: TicketStatus): boolean {
    return other instanceof TicketStatus && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
