import { InvalidQuantityError } from '../errors/ticketing.errors';

const MIN = 1;
const MAX = 10;

/** RN-008: se compran entre 1 y 10 entradas por operación (evita acaparamiento). */
export class Quantity {
  private constructor(public readonly value: number) {}

  static create(value: number): Quantity {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < MIN || value > MAX) {
      throw new InvalidQuantityError();
    }
    return new Quantity(value);
  }

  equals(other: Quantity): boolean {
    return other instanceof Quantity && this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
