import { InvalidHolderEmailError } from '../errors/ticketing.errors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_LENGTH = 254;

/** RN-011: email del titular, sin espacios exteriores y en minúsculas. */
export class HolderEmail {
  private constructor(public readonly value: string) {}

  static create(value: string): HolderEmail {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    // La longitud se comprueba ANTES de la expresión regular (evita ReDoS con entradas enormes).
    if (normalized.length === 0 || normalized.length > MAX_LENGTH || !EMAIL_PATTERN.test(normalized)) {
      throw new InvalidHolderEmailError();
    }
    return new HolderEmail(normalized);
  }

  equals(other: HolderEmail): boolean {
    return other instanceof HolderEmail && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
