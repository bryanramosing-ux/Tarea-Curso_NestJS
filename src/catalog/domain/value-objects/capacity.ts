import { InvalidCapacityError } from '../errors/event.errors';

const MIN = 1;
const MAX = 100_000;

/** RN-004: aforo entero entre 1 y 100.000 personas. */
export class Capacity {
  private constructor(public readonly value: number) {}

  static create(value: number): Capacity {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < MIN || value > MAX) {
      throw new InvalidCapacityError();
    }
    return new Capacity(value);
  }

  equals(other: Capacity): boolean {
    return other instanceof Capacity && this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
