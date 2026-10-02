import { generateUuid, isValidUuid } from '../../../shared/domain/uuid';
import { InvalidUserIdError } from '../errors/user.errors';

export class UserId {
  private constructor(public readonly value: string) {}

  static create(value: string): UserId {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!isValidUuid(normalized)) {
      throw new InvalidUserIdError(String(value));
    }
    return new UserId(normalized);
  }

  static generate(): UserId {
    return new UserId(generateUuid());
  }

  equals(other: UserId): boolean {
    return other instanceof UserId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
