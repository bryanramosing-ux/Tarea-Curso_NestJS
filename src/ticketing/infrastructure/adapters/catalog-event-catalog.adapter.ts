import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetEventQuery } from '../../../catalog/application/queries/get-event/get-event.query';
import { EventView } from '../../../catalog/application/views/event.view';
import { DomainException } from '../../../shared/domain/domain-exception';
import { EventCatalog } from '../../domain/ports/event-catalog.port';
import { EventReference } from '../../domain/value-objects/event-reference';
import { Money } from '../../domain/value-objects/money';
import { SaleableEvent } from '../../domain/value-objects/saleable-event';

const EVENT_NOT_FOUND = 'EVENT_NOT_FOUND';
const SCHEDULED_STATUS = 'SCHEDULED';

/**
 * Anti-corruption layer Venta → Catálogo.
 * Consulta el catálogo únicamente por su API pública de lectura (GetEventQuery
 * por el QueryBus) y traduce la EventView al modelo propio de la venta
 * (SaleableEvent). Nunca toca el dominio ni la tabla del catálogo.
 */
@Injectable()
export class CatalogEventCatalog implements EventCatalog {
  constructor(private readonly queryBus: QueryBus) {}

  async findEvent(id: EventReference): Promise<SaleableEvent | null> {
    try {
      const event: EventView = await this.queryBus.execute(new GetEventQuery(id.value));
      return SaleableEvent.create({
        id,
        capacity: event.capacity,
        startsAt: new Date(event.startsAt),
        unitPrice: Money.create(event.price.amountCents, event.price.currency),
        onSale: event.status === SCHEDULED_STATUS,
      });
    } catch (error) {
      if (error instanceof DomainException && error.code === EVENT_NOT_FOUND) {
        return null;
      }
      throw error;
    }
  }
}
