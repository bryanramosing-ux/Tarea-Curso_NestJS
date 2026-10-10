import { isValidUuid } from '../../../shared/domain/uuid';
import { InvalidTicketIdError } from '../errors/ticketing.errors';

/** Identidad de una entrada (UUID). Los nuevos los genera el puerto IdGenerator. */
export class TicketId {
  private constructor(public readonly value: string) {}

  static create(value: string): TicketId {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!isValidUuid(normalized)) {
      throw new InvalidTicketIdError();
    }
    return new TicketId(normalized);
  }

  equals(other: TicketId): boolean {
    return other instanceof TicketId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
