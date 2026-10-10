import { Injectable } from '@nestjs/common';
import { MoreThan, QueryFailedError, Repository } from 'typeorm';
import { TypeOrmTransactionContext } from '../../../../shared/infrastructure/persistence/typeorm-transaction-context';
import { TicketAllocation } from '../../../domain/entities/ticket-allocation';
import { SalesConcurrentModificationError } from '../../../domain/errors/ticketing.errors';
import { TicketAllocationRepository } from '../../../domain/ports/ticket-allocation.repository';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { SalesStatusValue } from '../../../domain/value-objects/sales-status';
import { TicketAllocationMapper } from './ticket-allocation.mapper';
import { TicketAllocationOrmEntity } from './ticket-allocation.orm-entity';

const UNIQUE_VIOLATION = '23505';
export const TICKET_ALLOCATIONS_PRIMARY_KEY = 'pk_ticket_allocations';

/**
 * Adaptador real del puerto TicketAllocationRepository.
 * Es la pieza que hace cumplir RN-009 ante compras simultáneas:
 *  - el cupo nuevo se INSERTA; si dos operaciones lo crean a la vez (dos
 *    primeras compras, o una compra y un cierre por cancelación), la clave
 *    primaria rechaza a una y se traduce en conflicto (se reintenta);
 *  - el cupo existente se ACTUALIZA solo si su versión no cambió desde que se leyó.
 * La base, además, garantiza sold <= capacity con una restricción CHECK.
 * Usa la transacción en curso si la hay (TypeOrmTransactionContext).
 */
@Injectable()
export class TypeOrmTicketAllocationRepository implements TicketAllocationRepository {
  constructor(private readonly context: TypeOrmTransactionContext) {}

  private get repository(): Repository<TicketAllocationOrmEntity> {
    return this.context.getRepository(TicketAllocationOrmEntity);
  }

  async save(allocation: TicketAllocation): Promise<void> {
    const row = TicketAllocationMapper.toPersistence(allocation);
    try {
      if (allocation.version === 0) {
        await this.repository.insert({ ...row, version: 1 });
      } else {
        const { eventId, version, ...changes } = row;
        const result = await this.repository.update({ eventId, version }, { ...changes, version: version + 1 });
        if (!result.affected) {
          throw new SalesConcurrentModificationError(eventId);
        }
      }
    } catch (error) {
      if (this.isDuplicatedAllocation(error)) {
        throw new SalesConcurrentModificationError(row.eventId);
      }
      throw error;
    }
    allocation.markAsPersisted();
  }

  async findByEvent(eventId: EventReference): Promise<TicketAllocation | null> {
    const row = await this.repository.findOneBy({ eventId: eventId.value });
    return row ? TicketAllocationMapper.toDomain(row) : null;
  }

  async findOpen(limit: number, after?: EventReference): Promise<TicketAllocation[]> {
    const rows = await this.repository.find({
      where: { status: SalesStatusValue.OPEN, ...(after ? { eventId: MoreThan(after.value) } : {}) },
      order: { eventId: 'ASC' },
      take: limit,
    });
    return rows.map((row) => TicketAllocationMapper.toDomain(row));
  }

  private isDuplicatedAllocation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = error.driverError as { code?: string; constraint?: string };
    return driverError.code === UNIQUE_VIOLATION && driverError.constraint === TICKET_ALLOCATIONS_PRIMARY_KEY;
  }
}
