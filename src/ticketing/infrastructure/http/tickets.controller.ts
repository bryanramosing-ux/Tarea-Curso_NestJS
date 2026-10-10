import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { RequireRoles, Role } from '../../../shared/infrastructure/http/auth/roles';
import { parseIdPipe } from '../../../shared/infrastructure/http/parse-id.pipe';
import { SensitiveRoute } from '../../../shared/infrastructure/http/throttling/sensitive-route';
import { CheckInTicketCommand, CheckInTicketResult } from '../../application/commands/check-in-ticket/check-in-ticket.command';
import {
  PurchaseTicketsCommand,
  PurchaseTicketsResult,
} from '../../application/commands/purchase-tickets/purchase-tickets.command';
import { ReconcileSalesCommand, ReconcileSalesResult } from '../../application/commands/reconcile-sales/reconcile-sales.command';
import { GetEventAvailabilityQuery } from '../../application/queries/get-event-availability/get-event-availability.query';
import { GetTicketQuery } from '../../application/queries/get-ticket/get-ticket.query';
import { AvailabilityView } from '../../application/views/availability.view';
import { TicketView } from '../../application/views/ticket.view';
import { CheckInDto } from './dto/check-in.dto';
import { PurchaseTicketsDto } from './dto/purchase-tickets.dto';

/**
 * Adaptador de entrada HTTP de la venta: solo despacha comandos y consultas.
 * Comprar y consultar la disponibilidad es público (con límite estricto de
 * peticiones en la compra); el check-in y la consulta de una entrada (contiene
 * datos personales) exigen clave del personal; conciliar, la del organizador.
 */
@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SensitiveRoute()
  purchase(@Body() dto: PurchaseTicketsDto): Promise<PurchaseTicketsResult> {
    return this.commandBus.execute(
      new PurchaseTicketsCommand(dto.eventId, dto.quantity, dto.holderName, dto.holderEmail),
    );
  }

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  @SensitiveRoute()
  @RequireRoles(Role.GATE, Role.ORGANIZER)
  checkIn(@Body() dto: CheckInDto): Promise<CheckInTicketResult> {
    return this.commandBus.execute(new CheckInTicketCommand(dto.eventId, dto.code));
  }

  @Post('sales/reconcile')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(Role.ORGANIZER)
  reconcile(): Promise<ReconcileSalesResult> {
    return this.commandBus.execute(new ReconcileSalesCommand());
  }

  @Get('availability/:eventId')
  availability(@Param('eventId', parseIdPipe()) eventId: string): Promise<AvailabilityView> {
    return this.queryBus.execute(new GetEventAvailabilityQuery(eventId));
  }

  @Get(':id')
  @RequireRoles(Role.GATE, Role.ORGANIZER)
  findOne(@Param('id', parseIdPipe()) id: string): Promise<TicketView> {
    return this.queryBus.execute(new GetTicketQuery(id));
  }
}
