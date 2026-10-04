import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EventNotFoundError } from '../../../domain/errors/event.errors';
import { EVENT_REPOSITORY, EventRepository } from '../../../domain/ports/event.repository';
import { EventId } from '../../../domain/value-objects/event-id';
import { EventView, toEventView } from '../../views/event.view';
import { GetEventQuery } from './get-event.query';

@QueryHandler(GetEventQuery)
export class GetEventHandler implements IQueryHandler<GetEventQuery> {
  constructor(@Inject(EVENT_REPOSITORY) private readonly events: EventRepository) {}

  async execute(query: GetEventQuery): Promise<EventView> {
    const id = EventId.create(query.eventId);
    const event = await this.events.findById(id);
    if (!event) {
      throw new EventNotFoundError(id.value);
    }
    return toEventView(event);
  }
}
