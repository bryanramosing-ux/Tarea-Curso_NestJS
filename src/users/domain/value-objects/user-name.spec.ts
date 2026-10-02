import { InvalidUserNameError } from '../errors/user.errors';
import { UserName } from './user-name';

describe('UserName (RN-003)', () => {
  it('trims and collapses inner whitespace', () => {
    expect(UserName.create('  Ana    María  Pérez ').value).toBe('Ana María Pérez');
  });

  it('accepts the boundaries 2 and 80 characters', () => {
    expect(UserName.create('Al').value).toBe('Al');
    expect(UserName.create('x'.repeat(80)).value).toHaveLength(80);
  });

  it.each(['', ' ', 'A', 'x'.repeat(81)])('rejects %p', (value) => {
    expect(() => UserName.create(value)).toThrow(InvalidUserNameError);
  });

  it('compares by value', () => {
    expect(UserName.create('Ana  Pérez').equals(UserName.create('Ana Pérez'))).toBe(true);
    expect(UserName.create('Ana').equals(UserName.create('Luis'))).toBe(false);
  });
});
