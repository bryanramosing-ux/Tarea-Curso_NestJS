import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { parseIdPipe } from '../../../shared/infrastructure/http/parse-id.pipe';
import { CancelEventCommand } from '../../application/commands/cancel-event/cancel-event.command';
import { ScheduleEventCommand, ScheduleEventResult } from '../../application/commands/schedule-event/schedule-event.command';
import { GetEventQuery } from '../../application/queries/get-event/get-event.query';
import { ListEventsQuery } from '../../application/queries/list-events/list-events.query';
import { EventView } from '../../application/views/event.view';
import { ListEventsQueryDto } from './dto/list-events.query-dto';
import { ScheduleEventDto } from './dto/schedule-event.dto';

/**
 * Adaptador de entrada HTTP del catálogo. Delgado: traduce HTTP -> comando o
 * consulta y despacha por los buses. Sin reglas de negocio ni repositorios.
 */
@Controller('events')
export class EventsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  schedule(@Body() dto: ScheduleEventDto): Promise<ScheduleEventResult> {
    return this.commandBus.execute(
      new ScheduleEventCommand(dto.name, dto.venue, dto.startsAt, dto.capacity, dto.priceCents, dto.currency),
    );
  }

  @Get()
  list(@Query() filters: ListEventsQueryDto): Promise<EventView[]> {
    return this.queryBus.execute(new ListEventsQuery(filters.status));
  }

  @Get(':id')
  findOne(@Param('id', parseIdPipe()) id: string): Promise<EventView> {
    return this.queryBus.execute(new GetEventQuery(id));
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(@Param('id', parseIdPipe()) id: string): Promise<void> {
    return this.commandBus.execute(new CancelEventCommand(id));
  }
}
