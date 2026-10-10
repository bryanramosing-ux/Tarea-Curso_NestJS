import { Query } from '@nestjs/cqrs';
import { EventPage } from '../../views/event.view';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Caso de uso de lectura: cartelera paginada, opcionalmente filtrada por estado. */
export class ListEventsQuery extends Query<EventPage> {
  constructor(
    public readonly status?: string,
    public readonly limit: number = DEFAULT_PAGE_SIZE,
    public readonly offset: number = 0,
  ) {
    super();
  }
}
