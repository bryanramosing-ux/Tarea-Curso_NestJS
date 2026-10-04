import { InvalidEventNameError } from '../errors/event.errors';

const MIN_LENGTH = 3;
const MAX_LENGTH = 120;

/** RN-001: nombre de 3 a 120 caracteres, con espacios normalizados. */
export class EventName {
  private constructor(public readonly value: string) {}

  static create(value: string): EventName {
    const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    if (normalized.length < MIN_LENGTH || normalized.length > MAX_LENGTH) {
      throw new InvalidEventNameError();
    }
    return new EventName(normalized);
  }

  equals(other: EventName): boolean {
    return other instanceof EventName && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
