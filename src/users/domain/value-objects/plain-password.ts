import { WeakPasswordError } from '../errors/user.errors';

const MIN_LENGTH = 8;
const MAX_LENGTH = 72;
const HAS_LETTER = /\p{L}/u;
const HAS_DIGIT = /\d/;
const REDACTED = '[REDACTED]';

/**
 * RN-004: contraseña en claro que cumple la política.
 * Solo vive en memoria durante el registro: nunca se persiste ni se serializa.
 * `toString()` y `toJSON()` devuelven un marcador para que no aparezca en logs.
 */
export class PlainPassword {
  private constructor(private readonly secret: string) {}

  static create(value: string): PlainPassword {
    if (
      typeof value !== 'string' ||
      value.length < MIN_LENGTH ||
      value.length > MAX_LENGTH ||
      !HAS_LETTER.test(value) ||
      !HAS_DIGIT.test(value)
    ) {
      throw new WeakPasswordError();
    }
    return new PlainPassword(value);
  }

  /** Acceso explícito e intencional: solo el adaptador de hashing lo usa. */
  reveal(): string {
    return this.secret;
  }

  equals(other: PlainPassword): boolean {
    return other instanceof PlainPassword && this.secret === other.secret;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }
}
