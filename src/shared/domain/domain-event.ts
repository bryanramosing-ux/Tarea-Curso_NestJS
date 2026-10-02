/**
 * Contrato mínimo de un evento de dominio: un hecho ya ocurrido
 * (nombre en pasado) representado como una clase plana.
 */
export interface DomainEvent {
  readonly eventName: string;
  readonly occurredOn: Date;
}
