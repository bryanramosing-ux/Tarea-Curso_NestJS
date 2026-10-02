import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { User } from '../../../domain/entities/user';
import { UserEmailAlreadyInUseError } from '../../../domain/errors/user.errors';
import { PASSWORD_HASHER, PasswordHasher } from '../../../domain/ports/password-hasher.port';
import { USER_REPOSITORY, UserRepository } from '../../../domain/ports/user.repository';
import { Email } from '../../../domain/value-objects/email';
import { PlainPassword } from '../../../domain/value-objects/plain-password';
import { UserId } from '../../../domain/value-objects/user-id';
import { UserName } from '../../../domain/value-objects/user-name';
import { CreateUserCommand, CreateUserResult } from './create-user.command';

/**
 * Orquesta el registro: valida vía value objects, comprueba unicidad (RN-002),
 * delega el hashing al puerto, persiste y DESPUÉS publica los eventos.
 */
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CreateUserCommand): Promise<CreateUserResult> {
    const name = UserName.create(command.name);
    const email = Email.create(command.email);
    const password = PlainPassword.create(command.password);

    if (await this.users.findByEmail(email)) {
      throw new UserEmailAlreadyInUseError(email.value);
    }

    const passwordHash = await this.passwordHasher.hash(password);
    const user = User.register({ id: UserId.generate(), name, email, passwordHash });

    await this.users.save(user);
    await this.eventPublisher.publishAll(user.pullDomainEvents());

    return { id: user.id.value };
  }
}
