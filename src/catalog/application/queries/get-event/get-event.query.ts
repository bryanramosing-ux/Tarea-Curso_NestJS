import { Query } from '@nestjs/cqrs';
import { EventView } from '../../views/event.view';

/** Caso de uso de lectura: detalle de un evento. Es también la API pública del catálogo para otros contextos. */
export class GetEventQuery extends Query<EventView> {
  constructor(public readonly eventId: string) {
    super();
  }
}
