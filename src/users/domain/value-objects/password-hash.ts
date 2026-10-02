import { InvalidPasswordHashError } from '../errors/user.errors';

const MAX_LENGTH = 255;
const REDACTED = '[REDACTED]';

/**
 * RN-004: hash de contraseña ya calculado por el puerto PasswordHasher.
 * El dominio no sabe cómo se calcula; solo garantiza que no esté vacío.
 * Nunca se expone en vistas, eventos ni logs.
 */
export class PasswordHash {
  private constructor(public readonly value: string) {}

  static create(value: string): PasswordHash {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > MAX_LENGTH || /\s/.test(value)) {
      throw new InvalidPasswordHashError();
    }
    return new PasswordHash(value);
  }

  equals(other: PasswordHash): boolean {
    return other instanceof PasswordHash && this.value === other.value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }
}
