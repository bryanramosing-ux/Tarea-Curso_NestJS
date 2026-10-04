import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { Event } from '../../../domain/entities/event';
import { EventSlotTakenError } from '../../../domain/errors/event.errors';
import { EVENT_REPOSITORY, EventRepository } from '../../../domain/ports/event.repository';
import { Capacity } from '../../../domain/value-objects/capacity';
import { EventId } from '../../../domain/value-objects/event-id';
import { EventName } from '../../../domain/value-objects/event-name';
import { EventStart } from '../../../domain/value-objects/event-start';
import { TicketPrice } from '../../../domain/value-objects/ticket-price';
import { Venue } from '../../../domain/value-objects/venue';
import { ScheduleEventCommand, ScheduleEventResult } from './schedule-event.command';

/**
 * Orquesta la programación: valida vía value objects, comprueba que el
 * recinto esté libre a esa hora (RN-006), delega al agregado (RN-003),
 * persiste y DESPUÉS publica los eventos.
 */
@CommandHandler(ScheduleEventCommand)
export class ScheduleEventHandler implements ICommandHandler<ScheduleEventCommand> {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: ScheduleEventCommand): Promise<ScheduleEventResult> {
    const name = EventName.create(command.name);
    const venue = Venue.create(command.venue);
    const startsAt = EventStart.create(command.startsAt);
    const capacity = Capacity.create(command.capacity);
    const price = TicketPrice.create(command.priceCents, command.currency);

    if (await this.events.findByVenueAndStart(venue, startsAt)) {
      throw new EventSlotTakenError(venue.value, startsAt.value);
    }

    const event = Event.schedule({ id: EventId.generate(), name, venue, startsAt, capacity, price });

    await this.events.save(event);
    await this.eventPublisher.publishAll(event.pullDomainEvents());

    return { id: event.id.value };
  }
}
