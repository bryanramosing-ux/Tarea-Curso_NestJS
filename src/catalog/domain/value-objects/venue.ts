import { InvalidVenueError } from '../errors/event.errors';

const MIN_LENGTH = 2;
const MAX_LENGTH = 120;

/**
 * RN-002: recinto de 2 a 120 caracteres, con espacios normalizados.
 * Conserva las mayúsculas para mostrarlo, pero dos recintos son el mismo
 * aunque se escriban con distinta capitalización ("Estadio Nacional" = "estadio nacional").
 */
export class Venue {
  private constructor(public readonly value: string) {}

  static create(value: string): Venue {
    const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    if (normalized.length < MIN_LENGTH || normalized.length > MAX_LENGTH) {
      throw new InvalidVenueError();
    }
    return new Venue(normalized);
  }

  /** Clave de comparación (la misma que usa el índice único de la base: lower(venue)). */
  get key(): string {
    return this.value.toLowerCase();
  }

  equals(other: Venue): boolean {
    return other instanceof Venue && this.key === other.key;
  }

  toString(): string {
    return this.value;
  }
}
