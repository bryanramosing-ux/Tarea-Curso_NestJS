import { InvalidEventStartError } from '../errors/event.errors';

/**
 * Fecha y hora de inicio de un evento (sin milisegundos, para que la
 * comparación "mismo recinto, misma hora" de RN-006 sea exacta).
 * Que sea futura (RN-003) lo decide el agregado al programarlo: un evento
 * ya pasado sigue siendo válido cuando se reconstruye desde la base.
 */
export class EventStart {
  private constructor(private readonly date: Date) {}

  static create(value: Date | string): EventStart {
    const date = value instanceof Date ? new Date(value.getTime()) : typeof value === 'string' ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      throw new InvalidEventStartError();
    }
    date.setUTCMilliseconds(0);
    return new EventStart(date);
  }

  get value(): Date {
    return new Date(this.date.getTime());
  }

  isAfter(moment: Date): boolean {
    return this.date.getTime() > moment.getTime();
  }

  equals(other: EventStart): boolean {
    return other instanceof EventStart && this.date.getTime() === other.date.getTime();
  }

  toString(): string {
    return this.date.toISOString();
  }
}
