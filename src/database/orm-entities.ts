import { EventOrmEntity } from '../catalog/infrastructure/persistence/typeorm/event.orm-entity';
import { TicketAllocationOrmEntity } from '../ticketing/infrastructure/persistence/typeorm/ticket-allocation.orm-entity';
import { TicketOrmEntity } from '../ticketing/infrastructure/persistence/typeorm/ticket.orm-entity';

/** Modelos de persistencia registrados (lista explícita, sin globs frágiles). */
export const ORM_ENTITIES = [EventOrmEntity, TicketAllocationOrmEntity, TicketOrmEntity];
