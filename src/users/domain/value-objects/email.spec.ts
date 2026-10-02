import { DomainErrorKind } from '../../../shared/domain/domain-exception';
import { InvalidEmailError } from '../errors/user.errors';
import { Email } from './email';

describe('Email (RN-001)', () => {
  it('normalizes surrounding spaces and casing', () => {
    expect(Email.create('  Ana.Perez@Startup.IO ').value).toBe('ana.perez@startup.io');
  });

  it.each(['', '   ', 'ana', 'ana@', '@startup.io', 'ana@startup', 'ana perez@startup.io', 'ana@@startup.io'])(
    'rejects the invalid address %p',
    (value) => {
      expect(() => Email.create(value)).toThrow(InvalidEmailError);
    },
  );

  it('rejects addresses longer than 254 characters', () => {
    const local = 'a'.repeat(64);
    const domain = `${'b'.repeat(190)}.io`;
    expect(() => Email.create(`${local}@${domain}`)).toThrow(InvalidEmailError);
  });

  it('rejects non string input coming from untyped layers', () => {
    expect(() => Email.create(undefined as unknown as string)).toThrow(InvalidEmailError);
  });

  it('raises a VALIDATION error with a stable code', () => {
    expect(() => Email.create('nope')).toThrow(
      expect.objectContaining({ code: 'USER_INVALID_EMAIL', kind: DomainErrorKind.VALIDATION }),
    );
  });

  it('compares by value with equals()', () => {
    expect(Email.create('ANA@startup.io').equals(Email.create('ana@startup.io'))).toBe(true);
    expect(Email.create('ana@startup.io').equals(Email.create('luis@startup.io'))).toBe(false);
  });
});
