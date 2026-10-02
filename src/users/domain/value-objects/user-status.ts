import { InvalidUserStatusError } from '../errors/user.errors';

export const UserStatusValue = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type UserStatusValue = (typeof UserStatusValue)[keyof typeof UserStatusValue];

const VALID_VALUES: readonly string[] = Object.values(UserStatusValue);

export class UserStatus {
  private constructor(public readonly value: UserStatusValue) {}

  static create(value: string): UserStatus {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!VALID_VALUES.includes(normalized)) {
      throw new InvalidUserStatusError(String(value));
    }
    return new UserStatus(normalized as UserStatusValue);
  }

  static active(): UserStatus {
    return new UserStatus(UserStatusValue.ACTIVE);
  }

  static inactive(): UserStatus {
    return new UserStatus(UserStatusValue.INACTIVE);
  }

  isActive(): boolean {
    return this.value === UserStatusValue.ACTIVE;
  }

  equals(other: UserStatus): boolean {
    return other instanceof UserStatus && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
