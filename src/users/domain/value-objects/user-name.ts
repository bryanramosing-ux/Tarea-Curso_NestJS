import { InvalidUserNameError } from '../errors/user.errors';

const MIN_LENGTH = 2;
const MAX_LENGTH = 80;

/** RN-003: nombre de 2 a 80 caracteres, con espacios normalizados. */
export class UserName {
  private constructor(public readonly value: string) {}

  static create(value: string): UserName {
    const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    if (normalized.length < MIN_LENGTH || normalized.length > MAX_LENGTH) {
      throw new InvalidUserNameError();
    }
    return new UserName(normalized);
  }

  equals(other: UserName): boolean {
    return other instanceof UserName && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
