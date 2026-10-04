import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { parseIdPipe } from '../../../shared/infrastructure/http/parse-id.pipe';
import { CheckInTicketCommand, CheckInTicketResult } from '../../application/commands/check-in-ticket/check-in-ticket.command';
import {
  PurchaseTicketsCommand,
  PurchaseTicketsResult,
} from '../../application/commands/purchase-tickets/purchase-tickets.command';
import { GetEventAvailabilityQuery } from '../../application/queries/get-event-availability/get-event-availability.query';
import { GetTicketQuery } from '../../application/queries/get-ticket/get-ticket.query';
import { AvailabilityView } from '../../application/views/availability.view';
import { TicketView } from '../../application/views/ticket.view';
import { CheckInDto } from './dto/check-in.dto';
import { PurchaseTicketsDto } from './dto/purchase-tickets.dto';

/** Adaptador de entrada HTTP de la venta: solo despacha comandos y consultas. */
@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  purchase(@Body() dto: PurchaseTicketsDto): Promise<PurchaseTicketsResult> {
    return this.commandBus.execute(
      new PurchaseTicketsCommand(dto.eventId, dto.quantity, dto.holderName, dto.holderEmail),
    );
  }

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  checkIn(@Body() dto: CheckInDto): Promise<CheckInTicketResult> {
    return this.commandBus.execute(new CheckInTicketCommand(dto.code));
  }

  @Get('availability/:eventId')
  availability(@Param('eventId', parseIdPipe()) eventId: string): Promise<AvailabilityView> {
    return this.queryBus.execute(new GetEventAvailabilityQuery(eventId));
  }

  @Get(':id')
  findOne(@Param('id', parseIdPipe()) id: string): Promise<TicketView> {
    return this.queryBus.execute(new GetTicketQuery(id));
  }
}
