import { WeakPasswordError } from '../errors/user.errors';
import { PlainPassword } from './plain-password';

describe('PlainPassword (RN-004)', () => {
  it('accepts a password with letters and digits between 8 and 72 characters', () => {
    expect(PlainPassword.create('secret123').reveal()).toBe('secret123');
  });

  it.each([
    ['too short', 'abc123'],
    ['without digits', 'onlyletters'],
    ['without letters', '1234567890'],
    ['too long', `a1${'x'.repeat(71)}`],
    ['empty', ''],
  ])('rejects a password %s', (_reason, value) => {
    expect(() => PlainPassword.create(value)).toThrow(WeakPasswordError);
  });

  it('never leaks the secret through toString, JSON or template strings', () => {
    const password = PlainPassword.create('secret123');
    expect(String(password)).toBe('[REDACTED]');
    expect(`${password}`).toBe('[REDACTED]');
    expect(JSON.stringify({ password })).toBe('{"password":"[REDACTED]"}');
  });

  it('does not include the rejected value in the error message', () => {
    expect(() => PlainPassword.create('short1')).toThrow(
      expect.objectContaining({ code: 'USER_WEAK_PASSWORD', message: expect.not.stringContaining('short1') }),
    );
  });

  it('compares by value', () => {
    expect(PlainPassword.create('secret123').equals(PlainPassword.create('secret123'))).toBe(true);
    expect(PlainPassword.create('secret123').equals(PlainPassword.create('secret124'))).toBe(false);
  });
});
