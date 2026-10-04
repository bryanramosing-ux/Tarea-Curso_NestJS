import { generateUuid, isValidUuid } from '../../../shared/domain/uuid';
import { InvalidTicketIdError } from '../errors/ticketing.errors';

export class TicketId {
  private constructor(public readonly value: string) {}

  static create(value: string): TicketId {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!isValidUuid(normalized)) {
      throw new InvalidTicketIdError(String(value));
    }
    return new TicketId(normalized);
  }

  static generate(): TicketId {
    return new TicketId(generateUuid());
  }

  equals(other: TicketId): boolean {
    return other instanceof TicketId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
