import { InvalidSaleableEventError } from '../errors/ticketing.errors';
import { EventReference } from './event-reference';
import { Money } from './money';

export interface SaleableEventProps {
  id: EventReference;
  capacity: number;
  startsAt: Date;
  unitPrice: Money;
  onSale: boolean;
}

/**
 * Lo que el contexto de venta necesita saber de un evento del catálogo:
 * aforo, inicio, precio y si sigue programado (se puede vender y admitir
 * público) o fue cancelado. Se obtiene por el puerto
 * EventCatalog (anti-corruption layer hacia el contexto Catálogo).
 */
export class SaleableEvent {
  private constructor(
    public readonly id: EventReference,
    public readonly capacity: number,
    private readonly start: Date,
    public readonly unitPrice: Money,
    private readonly sellable: boolean,
  ) {}

  static create(props: SaleableEventProps): SaleableEvent {
    if (!Number.isInteger(props.capacity) || props.capacity < 1) {
      throw new InvalidSaleableEventError('capacity must be a positive integer');
    }
    if (!(props.startsAt instanceof Date) || Number.isNaN(props.startsAt.getTime())) {
      throw new InvalidSaleableEventError('start date is invalid');
    }
    return new SaleableEvent(props.id, props.capacity, new Date(props.startsAt), props.unitPrice, props.onSale === true);
  }

  get startsAt(): Date {
    return new Date(this.start);
  }

  /** El catálogo lo tiene programado (SCHEDULED): se le pueden vender entradas. */
  isOnSale(): boolean {
    return this.sellable;
  }

  /** El catálogo lo canceló: no se vende y sus entradas no dan acceso (RN-010, RN-016). */
  isCancelled(): boolean {
    return !this.sellable;
  }

  equals(other: SaleableEvent): boolean {
    return (
      other instanceof SaleableEvent &&
      this.id.equals(other.id) &&
      this.capacity === other.capacity &&
      this.start.getTime() === other.start.getTime() &&
      this.unitPrice.equals(other.unitPrice) &&
      this.sellable === other.sellable
    );
  }
}
