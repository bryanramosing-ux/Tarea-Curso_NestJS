import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, QueryFailedError, Repository } from 'typeorm';
import { Event } from '../../../domain/entities/event';
import { EventConcurrentModificationError, EventSlotTakenError } from '../../../domain/errors/event.errors';
import { EventRepository, EventSearchCriteria } from '../../../domain/ports/event.repository';
import { EventId } from '../../../domain/value-objects/event-id';
import { EventStart } from '../../../domain/value-objects/event-start';
import { Venue } from '../../../domain/value-objects/venue';
import { EventMapper } from './event.mapper';
import { EventOrmEntity } from './event.orm-entity';

const UNIQUE_VIOLATION = '23505';
export const EVENTS_VENUE_START_UNIQUE_INDEX = 'uq_events_venue_starts_at';

/**
 * Adaptador real (PostgreSQL + TypeORM) del puerto EventRepository.
 * Solo consulta, guarda y traduce:
 *  - un agregado nuevo (version 0) se INSERTA; uno existente se ACTUALIZA solo
 *    si la versión almacenada sigue siendo la leída (bloqueo optimista);
 *  - la violación del índice único recinto + hora se traduce a RN-006, que la
 *    base garantiza incluso ante dos programaciones simultáneas.
 */
@Injectable()
export class TypeOrmEventRepository implements EventRepository {
  constructor(
    @InjectRepository(EventOrmEntity)
    private readonly repository: Repository<EventOrmEntity>,
  ) {}

  async save(event: Event): Promise<void> {
    const row = EventMapper.toPersistence(event);
    try {
      if (event.version === 0) {
        await this.repository.insert({ ...row, version: 1 });
      } else {
        const { id, version, ...changes } = row;
        const result = await this.repository.update({ id, version }, { ...changes, version: version + 1 });
        if (!result.affected) {
          throw new EventConcurrentModificationError(id);
        }
      }
    } catch (error) {
      if (this.isSlotUniqueViolation(error)) {
        throw new EventSlotTakenError(event.venue.value, event.startsAt.value);
      }
      throw error;
    }
    event.markAsPersisted();
  }

  async findById(id: EventId): Promise<Event | null> {
    const row = await this.repository.findOneBy({ id: id.value });
    return row ? EventMapper.toDomain(row) : null;
  }

  async findByVenueAndStart(venue: Venue, startsAt: EventStart): Promise<Event | null> {
    const row = await this.repository
      .createQueryBuilder('event')
      .where('LOWER(event.venue) = :venue', { venue: venue.key })
      .andWhere('event.startsAt = :startsAt', { startsAt: startsAt.value })
      .getOne();
    return row ? EventMapper.toDomain(row) : null;
  }

  async search(criteria: EventSearchCriteria): Promise<Event[]> {
    const where: FindOptionsWhere<EventOrmEntity> = {};
    if (criteria.status) {
      where.status = criteria.status.value;
    }
    const rows = await this.repository.find({ where, order: { startsAt: 'ASC', id: 'ASC' } });
    return rows.map((row) => EventMapper.toDomain(row));
  }

  private isSlotUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = error.driverError as { code?: string; constraint?: string };
    return driverError.code === UNIQUE_VIOLATION && driverError.constraint === EVENTS_VENUE_START_UNIQUE_INDEX;
  }
}
