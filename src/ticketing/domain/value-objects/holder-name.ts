import { InvalidHolderNameError } from '../errors/ticketing.errors';

const MIN_LENGTH = 2;
const MAX_LENGTH = 80;

/** RN-011: nombre del titular de la entrada, 2 a 80 caracteres normalizados. */
export class HolderName {
  private constructor(public readonly value: string) {}

  static create(value: string): HolderName {
    const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    if (normalized.length < MIN_LENGTH || normalized.length > MAX_LENGTH) {
      throw new InvalidHolderNameError();
    }
    return new HolderName(normalized);
  }

  equals(other: HolderName): boolean {
    return other instanceof HolderName && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
