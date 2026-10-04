import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../../../domain/entities/ticket';
import { TicketConcurrentModificationError } from '../../../domain/errors/ticketing.errors';
import { TicketRepository } from '../../../domain/ports/ticket.repository';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { TicketCodeHash } from '../../../domain/value-objects/ticket-code-hash';
import { TicketId } from '../../../domain/value-objects/ticket-id';
import { TicketStatusValue } from '../../../domain/value-objects/ticket-status';
import { TicketMapper } from './ticket.mapper';
import { TicketOrmEntity } from './ticket.orm-entity';

/** Adaptador real (PostgreSQL + TypeORM) del puerto TicketRepository, con bloqueo optimista. */
@Injectable()
export class TypeOrmTicketRepository implements TicketRepository {
  constructor(
    @InjectRepository(TicketOrmEntity)
    private readonly repository: Repository<TicketOrmEntity>,
  ) {}

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

  async findIssuedByEvent(eventId: EventReference): Promise<Ticket[]> {
    const rows = await this.repository.find({
      where: { eventId: eventId.value, status: TicketStatusValue.ISSUED },
      order: { purchasedAt: 'ASC', id: 'ASC' },
    });
    return rows.map((row) => TicketMapper.toDomain(row));
  }
}
