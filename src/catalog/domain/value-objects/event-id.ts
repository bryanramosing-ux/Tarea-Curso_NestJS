import { isValidUuid } from '../../../shared/domain/uuid';
import { InvalidEventIdError } from '../errors/event.errors';

/** Identidad de un evento (UUID). Los nuevos los genera el puerto IdGenerator. */
export class EventId {
  private constructor(public readonly value: string) {}

  static create(value: string): EventId {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!isValidUuid(normalized)) {
      throw new InvalidEventIdError();
    }
    return new EventId(normalized);
  }

  equals(other: EventId): boolean {
    return other instanceof EventId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
