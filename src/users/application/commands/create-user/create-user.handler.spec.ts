import { DomainErrorKind } from '../../../../shared/domain/domain-exception';
import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { UserEmailAlreadyInUseError, WeakPasswordError, InvalidEmailError } from '../../../domain/errors/user.errors';
import { UserRegistered } from '../../../domain/events/user-registered.event';
import { PasswordHasher } from '../../../domain/ports/password-hasher.port';
import { Email } from '../../../domain/value-objects/email';
import { PasswordHash } from '../../../domain/value-objects/password-hash';
import { PlainPassword } from '../../../domain/value-objects/plain-password';
import { UserId } from '../../../domain/value-objects/user-id';
import { InMemoryUserRepository } from '../../../infrastructure/persistence/in-memory/in-memory-user.repository';
import { CreateUserCommand } from './create-user.command';
import { CreateUserHandler } from './create-user.handler';

/** Doble de prueba determinista del puerto PasswordHasher. */
class FakePasswordHasher implements PasswordHasher {
  async hash(password: PlainPassword): Promise<PasswordHash> {
    return PasswordHash.create(`fake$${password.reveal().length}`);
  }

  async verify(): Promise<boolean> {
    return true;
  }
}

describe('CreateUserHandler (sin Nest, sin base de datos)', () => {
  let users: InMemoryUserRepository;
  let events: InMemoryDomainEventPublisher;
  let handler: CreateUserHandler;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    events = new InMemoryDomainEventPublisher();
    handler = new CreateUserHandler(users, new FakePasswordHasher(), events);
  });

  it('registers a user, stores only the hash and returns its id', async () => {
    const { id } = await handler.execute(new CreateUserCommand('  Ana  Pérez ', ' ANA@startup.io ', 'secret123'));

    const stored = await users.findById(UserId.create(id));
    expect(stored?.email.value).toBe('ana@startup.io');
    expect(stored?.name.value).toBe('Ana Pérez');
    expect(users.all()[0].passwordHash).toBe('fake$9');
    expect(JSON.stringify(users.all())).not.toContain('secret123');
  });

  it('publishes UserRegistered only after the user is persisted', async () => {
    const order: string[] = [];
    const save = users.save.bind(users);
    jest.spyOn(users, 'save').mockImplementation(async (user) => {
      order.push('save');
      await save(user);
    });
    jest.spyOn(events, 'publishAll').mockImplementation(async (published) => {
      order.push(`publish:${published.map((event) => event.eventName).join(',')}`);
    });

    await handler.execute(new CreateUserCommand('Ana', 'ana@startup.io', 'secret123'));

    expect(order).toEqual(['save', 'publish:users.user_registered']);
  });

  it('emits a UserRegistered event with the new id', async () => {
    const { id } = await handler.execute(new CreateUserCommand('Ana', 'ana@startup.io', 'secret123'));

    expect(events.published).toHaveLength(1);
    expect(events.published[0]).toBeInstanceOf(UserRegistered);
    expect(events.published[0]).toMatchObject({ userId: id });
  });

  it('rejects a duplicated email regardless of casing (RN-002, CONFLICT)', async () => {
    await handler.execute(new CreateUserCommand('Ana', 'ana@startup.io', 'secret123'));

    const attempt = handler.execute(new CreateUserCommand('Otra Ana', 'ANA@STARTUP.IO', 'secret456'));

    await expect(attempt).rejects.toBeInstanceOf(UserEmailAlreadyInUseError);
    await expect(attempt).rejects.toMatchObject({ kind: DomainErrorKind.CONFLICT });
    expect(users.all()).toHaveLength(1);
    expect(events.published).toHaveLength(1);
  });

  it('rejects a weak password before hashing or persisting anything (RN-004)', async () => {
    await expect(handler.execute(new CreateUserCommand('Ana', 'ana@startup.io', 'password'))).rejects.toBeInstanceOf(
      WeakPasswordError,
    );
    expect(users.all()).toHaveLength(0);
    expect(events.published).toHaveLength(0);
  });

  it('rejects an invalid email (RN-001)', async () => {
    await expect(handler.execute(new CreateUserCommand('Ana', 'ana-at-startup', 'secret123'))).rejects.toBeInstanceOf(
      InvalidEmailError,
    );
    expect(await users.findByEmail(Email.create('ana@startup.io'))).toBeNull();
  });
});
