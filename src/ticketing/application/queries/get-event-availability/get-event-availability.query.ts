import { Query } from '@nestjs/cqrs';
import { AvailabilityView } from '../../views/availability.view';

/** Caso de uso de lectura: ¿cuántas entradas quedan para un evento? */
export class GetEventAvailabilityQuery extends Query<AvailabilityView> {
  constructor(public readonly eventId: string) {
    super();
  }
}
