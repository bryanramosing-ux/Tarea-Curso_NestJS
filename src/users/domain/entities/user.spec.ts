import { DomainErrorKind } from '../../../shared/domain/domain-exception';
import {
  InvalidEmailError,
  InvalidUserStatusError,
  InvalidUserTimestampsError,
  UserAlreadyInactiveError,
} from '../errors/user.errors';
import { UserDeactivated } from '../events/user-deactivated.event';
import { UserRegistered } from '../events/user-registered.event';
import { Email } from '../value-objects/email';
import { PasswordHash } from '../value-objects/password-hash';
import { UserId } from '../value-objects/user-id';
import { UserName } from '../value-objects/user-name';
import { User, UserPrimitives } from './user';

const NOW = new Date('2026-01-10T10:00:00.000Z');
const LATER = new Date('2026-01-11T10:00:00.000Z');

function registerUser(): User {
  return User.register(
    {
      id: UserId.create('7c9e6679-7425-40de-944b-e07fc1f90ae7'),
      name: UserName.create('Ana Pérez'),
      email: Email.create('ana@startup.io'),
      passwordHash: PasswordHash.create('scrypt$hash'),
    },
    NOW,
  );
}

describe('User aggregate', () => {
  describe('register', () => {
    it('creates an ACTIVE user and records UserRegistered without credentials', () => {
      const user = registerUser();

      expect(user.isActive()).toBe(true);
      expect(user.createdAt).toEqual(NOW);
      const events = user.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(UserRegistered);
      expect(events[0]).toMatchObject({ userId: user.id.value, email: 'ana@startup.io', occurredOn: NOW });
      expect(JSON.stringify(events[0])).not.toContain('scrypt$hash');
    });

    it('empties the event list after pulling', () => {
      const user = registerUser();
      user.pullDomainEvents();
      expect(user.pullDomainEvents()).toEqual([]);
    });
  });

  describe('deactivate (RN-005)', () => {
    it('deactivates an active user and records UserDeactivated', () => {
      const user = registerUser();
      user.pullDomainEvents();

      user.deactivate(LATER);

      expect(user.isActive()).toBe(false);
      expect(user.updatedAt).toEqual(LATER);
      expect(user.pullDomainEvents()).toEqual([new UserDeactivated(user.id.value, LATER)]);
    });

    it('refuses to deactivate an inactive user (CONFLICT)', () => {
      const user = registerUser();
      user.deactivate(LATER);

      expect(() => user.deactivate(LATER)).toThrow(UserAlreadyInactiveError);
      expect(() => user.deactivate(LATER)).toThrow(
        expect.objectContaining({ code: 'USER_ALREADY_INACTIVE', kind: DomainErrorKind.CONFLICT }),
      );
    });
  });

  describe('toPrimitives / fromPrimitives', () => {
    it('round-trips without emitting events', () => {
      const original = registerUser();
      const restored = User.fromPrimitives(original.toPrimitives());

      expect(restored.toPrimitives()).toEqual(original.toPrimitives());
      expect(restored.pullDomainEvents()).toEqual([]);
    });

    it('re-validates every value when reconstructing', () => {
      const valid = registerUser().toPrimitives();
      const corrupt = (patch: Partial<UserPrimitives>): UserPrimitives => ({ ...valid, ...patch });

      expect(() => User.fromPrimitives(corrupt({ email: 'broken' }))).toThrow(InvalidEmailError);
      expect(() => User.fromPrimitives(corrupt({ status: 'DELETED' }))).toThrow(InvalidUserStatusError);
      expect(() => User.fromPrimitives(corrupt({ updatedAt: new Date('2020-01-01') }))).toThrow(
        InvalidUserTimestampsError,
      );
      expect(() => User.fromPrimitives(corrupt({ createdAt: new Date('invalid') }))).toThrow(
        InvalidUserTimestampsError,
      );
    });

    it('normalizes values on reconstruction', () => {
      const restored = User.fromPrimitives({ ...registerUser().toPrimitives(), email: ' ANA@startup.io ' });
      expect(restored.email.value).toBe('ana@startup.io');
    });
  });
});
