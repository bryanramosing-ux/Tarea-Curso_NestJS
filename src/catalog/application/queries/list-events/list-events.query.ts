import { Query } from '@nestjs/cqrs';
import { EventView } from '../../views/event.view';

/** Caso de uso de lectura: cartelera, opcionalmente filtrada por estado. */
export class ListEventsQuery extends Query<EventView[]> {
  constructor(public readonly status?: string) {
    super();
  }
}
