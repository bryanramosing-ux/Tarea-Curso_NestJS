import { DomainErrorKind, DomainException } from './domain-exception';
import { DomainEvent } from './domain-event';

export class InvalidAggregateVersionError extends DomainException {
  constructor(version: unknown) {
    super('INVALID_AGGREGATE_VERSION', DomainErrorKind.VALIDATION, `"${String(version)}" is not a valid aggregate version`);
  }
}

/**
 * Raíz de agregado.
 *  - Registra los eventos de dominio producidos por su comportamiento; el caso
 *    de uso los extrae con `pullDomainEvents()` y los publica DESPUÉS de persistir.
 *  - Lleva la `version` usada para el bloqueo optimista: 0 = nunca persistido,
 *    >= 1 = versión almacenada. El adaptador de persistencia solo guarda si la
 *    versión almacenada sigue siendo la que se leyó; si no, otra operación
 *    modificó el agregado en paralelo y el guardado se rechaza.
 */
export abstract class AggregateRoot {
  private domainEvents: DomainEvent[] = [];
  private _version: number;

  protected constructor(version: number) {
    if (!Number.isInteger(version) || version < 0) {
      throw new InvalidAggregateVersionError(version);
    }
    this._version = version;
  }

  /** Un agregado reconstruido desde persistencia siempre tiene versión >= 1. */
  protected static persistedVersion(version: number): number {
    if (!Number.isInteger(version) || version < 1) {
      throw new InvalidAggregateVersionError(version);
    }
    return version;
  }

  get version(): number {
    return this._version;
  }

  /** Lo invoca el adaptador de persistencia tras guardar con éxito. */
  markAsPersisted(): void {
    this._version += 1;
  }

  protected record(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
