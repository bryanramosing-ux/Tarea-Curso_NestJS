import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CancelEventHandler } from './application/commands/cancel-event/cancel-event.handler';
import { ScheduleEventHandler } from './application/commands/schedule-event/schedule-event.handler';
import { GetEventHandler } from './application/queries/get-event/get-event.handler';
import { ListEventsHandler } from './application/queries/list-events/list-events.handler';
import { EVENT_REPOSITORY } from './domain/ports/event.repository';
import { EventsController } from './infrastructure/http/events.controller';
import { EventOrmEntity } from './infrastructure/persistence/typeorm/event.orm-entity';
import { TypeOrmEventRepository } from './infrastructure/persistence/typeorm/typeorm-event.repository';

/**
 * Composición del contexto Catálogo: aquí (y solo aquí) se decide qué
 * implementación concreta satisface cada puerto.
 */
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([EventOrmEntity])],
  controllers: [EventsController],
  providers: [
    ScheduleEventHandler,
    CancelEventHandler,
    GetEventHandler,
    ListEventsHandler,
    { provide: EVENT_REPOSITORY, useClass: TypeOrmEventRepository },
  ],
})
export class CatalogModule {}
