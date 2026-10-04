import { isValidUuid } from '../../../shared/domain/uuid';
import { InvalidEventReferenceError } from '../errors/ticketing.errors';

/**
 * Referencia a un evento DESDE el contexto de venta de entradas.
 * Es deliberadamente distinta de EventId (contexto Catálogo): los contextos
 * no comparten value objects, solo el valor del identificador.
 */
export class EventReference {
  private constructor(public readonly value: string) {}

  static create(value: string): EventReference {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!isValidUuid(normalized)) {
      throw new InvalidEventReferenceError(String(value));
    }
    return new EventReference(normalized);
  }

  equals(other: EventReference): boolean {
    return other instanceof EventReference && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
