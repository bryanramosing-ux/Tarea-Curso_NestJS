import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { EventNotFoundError } from '../../../domain/errors/event.errors';
import { EVENT_REPOSITORY, EventRepository } from '../../../domain/ports/event.repository';
import { EventId } from '../../../domain/value-objects/event-id';
import { CancelEventCommand } from './cancel-event.command';

@CommandHandler(CancelEventCommand)
export class CancelEventHandler implements ICommandHandler<CancelEventCommand> {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CancelEventCommand): Promise<void> {
    const id = EventId.create(command.eventId);
    const event = await this.events.findById(id);
    if (!event) {
      throw new EventNotFoundError(id.value);
    }

    event.cancel();

    await this.events.save(event);
    await this.eventPublisher.publishAll(event.pullDomainEvents());
  }
}
