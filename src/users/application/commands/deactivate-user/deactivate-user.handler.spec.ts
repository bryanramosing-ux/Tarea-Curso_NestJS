import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { User } from '../../../domain/entities/user';
import { InvalidUserIdError, UserAlreadyInactiveError, UserNotFoundError } from '../../../domain/errors/user.errors';
import { UserDeactivated } from '../../../domain/events/user-deactivated.event';
import { Email } from '../../../domain/value-objects/email';
import { PasswordHash } from '../../../domain/value-objects/password-hash';
import { UserId } from '../../../domain/value-objects/user-id';
import { UserName } from '../../../domain/value-objects/user-name';
import { InMemoryUserRepository } from '../../../infrastructure/persistence/in-memory/in-memory-user.repository';
import { DeactivateUserCommand } from './deactivate-user.command';
import { DeactivateUserHandler } from './deactivate-user.handler';

describe('DeactivateUserHandler', () => {
  let users: InMemoryUserRepository;
  let events: InMemoryDomainEventPublisher;
  let handler: DeactivateUserHandler;
  let user: User;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    events = new InMemoryDomainEventPublisher();
    handler = new DeactivateUserHandler(users, events);
    user = User.register({
      id: UserId.generate(),
      name: UserName.create('Ana'),
      email: Email.create('ana@startup.io'),
      passwordHash: PasswordHash.create('fake$hash'),
    });
    await users.save(user);
  });

  it('deactivates the user, persists it and publishes UserDeactivated', async () => {
    await handler.execute(new DeactivateUserCommand(user.id.value));

    expect((await users.findById(user.id))?.isActive()).toBe(false);
    expect(events.published).toHaveLength(1);
    expect(events.published[0]).toBeInstanceOf(UserDeactivated);
    expect(events.published[0]).toMatchObject({ userId: user.id.value });
  });

  it('fails with NOT_FOUND when the user does not exist', async () => {
    await expect(handler.execute(new DeactivateUserCommand(UserId.generate().value))).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });

  it('fails with VALIDATION when the id is malformed', async () => {
    await expect(handler.execute(new DeactivateUserCommand('nope'))).rejects.toBeInstanceOf(InvalidUserIdError);
  });

  it('fails with CONFLICT the second time and publishes nothing new (RN-005)', async () => {
    await handler.execute(new DeactivateUserCommand(user.id.value));

    await expect(handler.execute(new DeactivateUserCommand(user.id.value))).rejects.toBeInstanceOf(
      UserAlreadyInactiveError,
    );
    expect(events.published).toHaveLength(1);
  });
});
