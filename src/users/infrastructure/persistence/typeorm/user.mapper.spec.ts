import { User } from '../../../domain/entities/user';
import { InvalidEmailError } from '../../../domain/errors/user.errors';
import { Email } from '../../../domain/value-objects/email';
import { PasswordHash } from '../../../domain/value-objects/password-hash';
import { UserId } from '../../../domain/value-objects/user-id';
import { UserName } from '../../../domain/value-objects/user-name';
import { UserMapper } from './user.mapper';
import { UserOrmEntity } from './user.orm-entity';

describe('UserMapper', () => {
  const user = User.register({
    id: UserId.generate(),
    name: UserName.create('Ana'),
    email: Email.create('ana@startup.io'),
    passwordHash: PasswordHash.create('scrypt$hash'),
  });

  it('maps the domain entity to a different ORM class and back', () => {
    const row = UserMapper.toPersistence(user);

    expect(row).toBeInstanceOf(UserOrmEntity);
    expect(row).not.toBeInstanceOf(User);
    expect(UserMapper.toDomain(row).toPrimitives()).toEqual(user.toPrimitives());
  });

  it('refuses to build a domain entity from a corrupt row', () => {
    const row = UserMapper.toPersistence(user);
    row.email = 'not-an-email';
    expect(() => UserMapper.toDomain(row)).toThrow(InvalidEmailError);
  });
});
