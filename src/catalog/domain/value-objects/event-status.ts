import { InvalidEventStatusError } from '../errors/event.errors';

export const EventStatusValue = {
  SCHEDULED: 'SCHEDULED',
  CANCELLED: 'CANCELLED',
} as const;

export type EventStatusValue = (typeof EventStatusValue)[keyof typeof EventStatusValue];

const VALID_VALUES: readonly string[] = Object.values(EventStatusValue);

export class EventStatus {
  private constructor(public readonly value: EventStatusValue) {}

  static create(value: string): EventStatus {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!VALID_VALUES.includes(normalized)) {
      throw new InvalidEventStatusError(String(value));
    }
    return new EventStatus(normalized as EventStatusValue);
  }

  static scheduled(): EventStatus {
    return new EventStatus(EventStatusValue.SCHEDULED);
  }

  static cancelled(): EventStatus {
    return new EventStatus(EventStatusValue.CANCELLED);
  }

  isCancelled(): boolean {
    return this.value === EventStatusValue.CANCELLED;
  }

  equals(other: EventStatus): boolean {
    return other instanceof EventStatus && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
