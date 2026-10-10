import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EVENT_REPOSITORY, EventRepository } from '../../../domain/ports/event.repository';
import { EventStatus } from '../../../domain/value-objects/event-status';
import { EventPage, toEventView } from '../../views/event.view';
import { ListEventsQuery, MAX_PAGE_SIZE } from './list-events.query';

/**
 * Pide UN evento más de los solicitados: si llega, hay otra página y se
 * informa su `nextOffset` sin hacer un COUNT(*) aparte.
 */
@QueryHandler(ListEventsQuery)
export class ListEventsHandler implements IQueryHandler<ListEventsQuery> {
  constructor(@Inject(EVENT_REPOSITORY) private readonly events: EventRepository) {}

  async execute(query: ListEventsQuery): Promise<EventPage> {
    const limit = Math.min(Math.max(Math.trunc(query.limit), 1), MAX_PAGE_SIZE);
    const offset = Math.max(Math.trunc(query.offset), 0);
    const events = await this.events.search({
      status: query.status === undefined ? undefined : EventStatus.create(query.status),
      limit: limit + 1,
      offset,
    });
    const hasMore = events.length > limit;
    return {
      items: events.slice(0, limit).map(toEventView),
      limit,
      offset,
      nextOffset: hasMore ? offset + limit : null,
    };
  }
}
