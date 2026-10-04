import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EVENT_REPOSITORY, EventRepository } from '../../../domain/ports/event.repository';
import { EventStatus } from '../../../domain/value-objects/event-status';
import { EventView, toEventView } from '../../views/event.view';
import { ListEventsQuery } from './list-events.query';

@QueryHandler(ListEventsQuery)
export class ListEventsHandler implements IQueryHandler<ListEventsQuery> {
  constructor(@Inject(EVENT_REPOSITORY) private readonly events: EventRepository) {}

  async execute(query: ListEventsQuery): Promise<EventView[]> {
    const events = await this.events.search({
      status: query.status === undefined ? undefined : EventStatus.create(query.status),
    });
    return events.map(toEventView);
  }
}
