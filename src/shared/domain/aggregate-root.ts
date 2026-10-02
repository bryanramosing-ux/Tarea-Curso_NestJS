import { DomainEvent } from './domain-event';

/**
 * Raíz de agregado: registra los eventos de dominio producidos por su
 * comportamiento. El caso de uso los extrae con `pullDomainEvents()`
 * y los publica DESPUÉS de persistir el agregado.
 */
export abstract class AggregateRoot {
  private domainEvents: DomainEvent[] = [];

  protected record(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
