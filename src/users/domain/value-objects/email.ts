import { InvalidEmailError } from '../errors/user.errors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_LENGTH = 254;

/** RN-001: email válido, sin espacios exteriores y en minúsculas. */
export class Email {
  private constructor(public readonly value: string) {}

  static create(value: string): Email {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized.length === 0 || normalized.length > MAX_LENGTH || !EMAIL_PATTERN.test(normalized)) {
      throw new InvalidEmailError();
    }
    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return other instanceof Email && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
