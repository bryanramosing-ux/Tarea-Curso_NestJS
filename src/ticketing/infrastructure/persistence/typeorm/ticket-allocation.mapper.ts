import { rehydrate } from '../../../../shared/infrastructure/persistence/persisted-data-corrupted.error';
import { TicketAllocation } from '../../../domain/entities/ticket-allocation';
import { TicketAllocationOrmEntity } from './ticket-allocation.orm-entity';

/** Traduce entre el agregado TicketAllocation y su modelo de persistencia. */
export class TicketAllocationMapper {
  /** Una fila que viola las reglas del dominio es un fallo del servidor (500), no del cliente. */
  static toDomain(row: TicketAllocationOrmEntity): TicketAllocation {
    return rehydrate('ticket_allocations', row.eventId, () =>
      TicketAllocation.fromPrimitives({
        eventId: row.eventId,
        capacity: row.capacity,
        sold: row.sold,
        priceCents: row.priceCents,
        currency: row.currency,
        startsAt: row.startsAt,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        version: row.version,
      }),
    );
  }

  static toPersistence(allocation: TicketAllocation): TicketAllocationOrmEntity {
    const primitives = allocation.toPrimitives();
    const row = new TicketAllocationOrmEntity();
    row.eventId = primitives.eventId;
    row.capacity = primitives.capacity;
    row.sold = primitives.sold;
    row.priceCents = primitives.priceCents;
    row.currency = primitives.currency;
    row.startsAt = primitives.startsAt;
    row.status = primitives.status;
    row.createdAt = primitives.createdAt;
    row.updatedAt = primitives.updatedAt;
    row.version = primitives.version;
    return row;
  }
}
