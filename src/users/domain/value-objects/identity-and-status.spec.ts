import { InvalidPasswordHashError, InvalidUserIdError, InvalidUserStatusError } from '../errors/user.errors';
import { PasswordHash } from './password-hash';
import { UserId } from './user-id';
import { UserStatus, UserStatusValue } from './user-status';

describe('UserId', () => {
  it('generates valid unique ids', () => {
    const a = UserId.generate();
    const b = UserId.generate();
    expect(UserId.create(a.value).equals(a)).toBe(true);
    expect(a.equals(b)).toBe(false);
  });

  it('normalizes casing', () => {
    expect(UserId.create('7C9E6679-7425-40DE-944B-E07FC1F90AE7').value).toBe('7c9e6679-7425-40de-944b-e07fc1f90ae7');
  });

  it.each(['', 'not-a-uuid', '123'])('rejects %p', (value) => {
    expect(() => UserId.create(value)).toThrow(InvalidUserIdError);
  });
});

describe('UserStatus', () => {
  it('creates known statuses', () => {
    expect(UserStatus.create('active').value).toBe(UserStatusValue.ACTIVE);
    expect(UserStatus.inactive().isActive()).toBe(false);
    expect(UserStatus.active().equals(UserStatus.create('ACTIVE'))).toBe(true);
  });

  it('rejects unknown statuses', () => {
    expect(() => UserStatus.create('BANNED')).toThrow(InvalidUserStatusError);
  });
});

describe('PasswordHash', () => {
  it('rejects empty or malformed hashes', () => {
    expect(() => PasswordHash.create('')).toThrow(InvalidPasswordHashError);
    expect(() => PasswordHash.create('has spaces')).toThrow(InvalidPasswordHashError);
  });

  it('is redacted when serialized', () => {
    const hash = PasswordHash.create('scrypt$abc$def');
    expect(JSON.stringify({ hash })).toBe('{"hash":"[REDACTED]"}');
    expect(String(hash)).toBe('[REDACTED]');
    expect(hash.equals(PasswordHash.create('scrypt$abc$def'))).toBe(true);
  });
});
