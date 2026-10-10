import { Injectable } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { TypeOrmTransactionContext } from '../../../../shared/infrastructure/persistence/typeorm-transaction-context';
import { Ticket } from '../../../domain/entities/ticket';
import { TicketConcurrentModificationError } from '../../../domain/errors/ticketing.errors';
import { TicketRepository } from '../../../domain/ports/ticket.repository';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { HolderEmail } from '../../../domain/value-objects/holder-email';
import { TicketCodeHash } from '../../../domain/value-objects/ticket-code-hash';
import { TicketId } from '../../../domain/value-objects/ticket-id';
import { TicketStatusValue } from '../../../domain/value-objects/ticket-status';
import { TicketMapper } from './ticket.mapper';
import { TicketOrmEntity } from './ticket.orm-entity';

/**
 * Adaptador real (PostgreSQL + TypeORM) del puerto TicketRepository, con
 * bloqueo optimista. Usa la transacción en curso si la hay.
 */
@Injectable()
export class TypeOrmTicketRepository implements TicketRepository {
  constructor(private readonly context: TypeOrmTransactionContext) {}

  private get repository(): Repository<TicketOrmEntity> {
    return this.context.getRepository(TicketOrmEntity);
  }

  async save(ticket: Ticket): Promise<void> {
    const row = TicketMapper.toPersistence(ticket);
    if (ticket.version === 0) {
      await this.repository.insert({ ...row, version: 1 });
    } else {
      const { id, version, ...changes } = row;
      const result = await this.repository.update({ id, version }, { ...changes, version: version + 1 });
      if (!result.affected) {
        throw new TicketConcurrentModificationError(id);
      }
    }
    ticket.markAsPersisted();
  }

  async findById(id: TicketId): Promise<Ticket | null> {
    const row = await this.repository.findOneBy({ id: id.value });
    return row ? TicketMapper.toDomain(row) : null;
  }

  async findByCodeHash(codeHash: TicketCodeHash): Promise<Ticket | null> {
    const row = await this.repository.findOneBy({ codeHash: codeHash.value });
    return row ? TicketMapper.toDomain(row) : null;
  }

  async findIssuedByEvent(eventId: EventReference, limit: number): Promise<Ticket[]> {
    const rows = await this.repository.find({
      where: { eventId: eventId.value, status: TicketStatusValue.ISSUED },
      order: { purchasedAt: 'ASC', id: 'ASC' },
      take: limit,
    });
    return rows.map((row) => TicketMapper.toDomain(row));
  }

  async countActiveByEventAndHolder(eventId: EventReference, holderEmail: HolderEmail): Promise<number> {
    return this.repository.countBy({
      eventId: eventId.value,
      holderEmail: holderEmail.value,
      status: In([TicketStatusValue.ISSUED, TicketStatusValue.USED]),
    });
  }
}
