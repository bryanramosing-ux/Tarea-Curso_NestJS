import { User } from '../../../domain/entities/user';
import { UserNotFoundError } from '../../../domain/errors/user.errors';
import { Email } from '../../../domain/value-objects/email';
import { PasswordHash } from '../../../domain/value-objects/password-hash';
import { UserId } from '../../../domain/value-objects/user-id';
import { UserName } from '../../../domain/value-objects/user-name';
import { InMemoryUserRepository } from '../../../infrastructure/persistence/in-memory/in-memory-user.repository';
import { GetUserHandler } from './get-user.handler';
import { GetUserQuery } from './get-user.query';

describe('GetUserHandler', () => {
  it('returns the public view without any credential field', async () => {
    const users = new InMemoryUserRepository();
    const user = User.register(
      {
        id: UserId.generate(),
        name: UserName.create('Ana'),
        email: Email.create('ana@startup.io'),
        passwordHash: PasswordHash.create('scrypt$super-secret-hash'),
      },
      new Date('2026-01-10T10:00:00.000Z'),
    );
    await users.save(user);

    const view = await new GetUserHandler(users).execute(new GetUserQuery(user.id.value));

    expect(view).toEqual({
      id: user.id.value,
      name: 'Ana',
      email: 'ana@startup.io',
      status: 'ACTIVE',
      createdAt: '2026-01-10T10:00:00.000Z',
      updatedAt: '2026-01-10T10:00:00.000Z',
    });
    expect(JSON.stringify(view)).not.toMatch(/password|hash/i);
  });

  it('throws NOT_FOUND for an unknown id', async () => {
    const handler = new GetUserHandler(new InMemoryUserRepository());
    await expect(handler.execute(new GetUserQuery(UserId.generate().value))).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
