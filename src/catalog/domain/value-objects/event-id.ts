import { generateUuid, isValidUuid } from '../../../shared/domain/uuid';
import { InvalidEventIdError } from '../errors/event.errors';

export class EventId {
  private constructor(public readonly value: string) {}

  static create(value: string): EventId {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!isValidUuid(normalized)) {
      throw new InvalidEventIdError(String(value));
    }
    return new EventId(normalized);
  }

  static generate(): EventId {
    return new EventId(generateUuid());
  }

  equals(other: EventId): boolean {
    return other instanceof EventId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
