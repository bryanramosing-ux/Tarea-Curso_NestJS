import { EventReference } from '../value-objects/event-reference';
import { SaleableEvent } from '../value-objects/saleable-event';

export const EVENT_CATALOG = Symbol('EVENT_CATALOG');

/**
 * Puerto PROPIO del contexto de venta para conocer los eventos del catálogo.
 * La venta no importa el dominio del catálogo: un adaptador de infraestructura
 * traduce la información del otro contexto a este modelo (ACL).
 * Devuelve `null` si el evento no existe.
 */
export interface EventCatalog {
  findEvent(id: EventReference): Promise<SaleableEvent | null>;
}
