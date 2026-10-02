import { DomainEvent } from '../domain-event';

/** Token de inyección: las interfaces no existen en tiempo de ejecución. */
export const DOMAIN_EVENT_PUBLISHER = Symbol('DOMAIN_EVENT_PUBLISHER');

/**
 * Puerto de salida para publicar eventos de dominio.
 * Los casos de uso lo invocan SIEMPRE después de persistir.
 */
export interface DomainEventPublisher {
  publishAll(events: DomainEvent[]): Promise<void>;
}
