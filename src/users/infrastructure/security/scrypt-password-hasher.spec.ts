import { PasswordHash } from '../../domain/value-objects/password-hash';
import { PlainPassword } from '../../domain/value-objects/plain-password';
import { ScryptPasswordHasher } from './scrypt-password-hasher';

describe('ScryptPasswordHasher (RN-004)', () => {
  const hasher = new ScryptPasswordHasher();
  const password = PlainPassword.create('secret123');

  it('never stores the password in clear text and salts every hash', async () => {
    const first = await hasher.hash(password);
    const second = await hasher.hash(password);

    expect(first.value).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(first.value).not.toContain('secret123');
    expect(first.equals(second)).toBe(false);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hasher.hash(password);

    await expect(hasher.verify(password, hash)).resolves.toBe(true);
    await expect(hasher.verify(PlainPassword.create('secret124'), hash)).resolves.toBe(false);
  });

  it('rejects hashes produced by an unknown algorithm', async () => {
    await expect(hasher.verify(password, PasswordHash.create('md5$abc$def'))).resolves.toBe(false);
  });
});
