import { User } from '../../../domain/entities/user';
import { UserEmailAlreadyInUseError } from '../../../domain/errors/user.errors';
import { Email } from '../../../domain/value-objects/email';
import { PasswordHash } from '../../../domain/value-objects/password-hash';
import { UserId } from '../../../domain/value-objects/user-id';
import { UserName } from '../../../domain/value-objects/user-name';
import { InMemoryUserRepository } from './in-memory-user.repository';

function newUser(email: string): User {
  return User.register({
    id: UserId.generate(),
    name: UserName.create('Ana'),
    email: Email.create(email),
    passwordHash: PasswordHash.create('fake$hash'),
  });
}

describe('InMemoryUserRepository (contrato del puerto UserRepository)', () => {
  it('returns null instead of throwing when nothing is found', async () => {
    const repository = new InMemoryUserRepository();
    await expect(repository.findById(UserId.generate())).resolves.toBeNull();
    await expect(repository.findByEmail(Email.create('nobody@startup.io'))).resolves.toBeNull();
  });

  it('returns independent copies (no shared references with the caller)', async () => {
    const repository = new InMemoryUserRepository();
    const user = newUser('ana@startup.io');
    await repository.save(user);

    const loaded = await repository.findById(user.id);
    loaded?.deactivate();

    expect((await repository.findById(user.id))?.isActive()).toBe(true);
  });

  it('emulates the database UNIQUE constraint on email', async () => {
    const repository = new InMemoryUserRepository();
    await repository.save(newUser('ana@startup.io'));
    await expect(repository.save(newUser('ana@startup.io'))).rejects.toBeInstanceOf(UserEmailAlreadyInUseError);
  });
});
