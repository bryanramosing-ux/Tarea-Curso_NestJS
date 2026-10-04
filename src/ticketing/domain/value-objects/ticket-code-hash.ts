import { InvalidTicketCodeHashError } from '../errors/ticketing.errors';

const HASH_PATTERN = /^[0-9a-f]{64}$/;

/** RN-012: huella del código (lo único que se guarda). La calcula el puerto TicketCodeHasher. */
export class TicketCodeHash {
  private constructor(public readonly value: string) {}

  static create(value: string): TicketCodeHash {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!HASH_PATTERN.test(normalized)) {
      throw new InvalidTicketCodeHashError();
    }
    return new TicketCodeHash(normalized);
  }

  equals(other: TicketCodeHash): boolean {
    return other instanceof TicketCodeHash && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
