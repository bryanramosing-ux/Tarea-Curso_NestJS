import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { UserNotFoundError } from '../../../domain/errors/user.errors';
import { USER_REPOSITORY, UserRepository } from '../../../domain/ports/user.repository';
import { UserId } from '../../../domain/value-objects/user-id';
import { DeactivateUserCommand } from './deactivate-user.command';

@CommandHandler(DeactivateUserCommand)
export class DeactivateUserHandler implements ICommandHandler<DeactivateUserCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: DeactivateUserCommand): Promise<void> {
    const id = UserId.create(command.userId);
    const user = await this.users.findById(id);
    if (!user) {
      throw new UserNotFoundError(id.value);
    }

    user.deactivate();

    await this.users.save(user);
    await this.eventPublisher.publishAll(user.pullDomainEvents());
  }
}
