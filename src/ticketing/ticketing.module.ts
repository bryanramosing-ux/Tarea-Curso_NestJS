import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvironmentVariables } from '../config/env.validation';
import { CheckInTicketHandler } from './application/commands/check-in-ticket/check-in-ticket.handler';
import { CloseEventSalesHandler } from './application/commands/close-event-sales/close-event-sales.handler';
import { PurchaseTicketsHandler } from './application/commands/purchase-tickets/purchase-tickets.handler';
import { GetEventAvailabilityHandler } from './application/queries/get-event-availability/get-event-availability.handler';
import { GetTicketHandler } from './application/queries/get-ticket/get-ticket.handler';
import { EVENT_CATALOG } from './domain/ports/event-catalog.port';
import { TICKET_ALLOCATION_REPOSITORY } from './domain/ports/ticket-allocation.repository';
import { TICKET_CODE_HASHER } from './domain/ports/ticket-code-hasher.port';
import { TICKET_REPOSITORY } from './domain/ports/ticket.repository';
import { CatalogEventCatalog } from './infrastructure/adapters/catalog-event-catalog.adapter';
import { CloseSalesOnEventCancelledListener } from './infrastructure/event-handlers/close-sales-on-event-cancelled.listener';
import { TicketsController } from './infrastructure/http/tickets.controller';
import { TicketAllocationOrmEntity } from './infrastructure/persistence/typeorm/ticket-allocation.orm-entity';
import { TicketOrmEntity } from './infrastructure/persistence/typeorm/ticket.orm-entity';
import { TypeOrmTicketAllocationRepository } from './infrastructure/persistence/typeorm/typeorm-ticket-allocation.repository';
import { TypeOrmTicketRepository } from './infrastructure/persistence/typeorm/typeorm-ticket.repository';
import { HmacTicketCodeHasher } from './infrastructure/security/hmac-ticket-code-hasher';

/** Composición del contexto Venta de entradas: enlaza cada puerto con su adaptador. */
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([TicketAllocationOrmEntity, TicketOrmEntity])],
  controllers: [TicketsController],
  providers: [
    PurchaseTicketsHandler,
    CheckInTicketHandler,
    CloseEventSalesHandler,
    GetTicketHandler,
    GetEventAvailabilityHandler,
    CloseSalesOnEventCancelledListener,
    { provide: TICKET_ALLOCATION_REPOSITORY, useClass: TypeOrmTicketAllocationRepository },
    { provide: TICKET_REPOSITORY, useClass: TypeOrmTicketRepository },
    { provide: EVENT_CATALOG, useClass: CatalogEventCatalog },
    {
      provide: TICKET_CODE_HASHER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        new HmacTicketCodeHasher(config.get('TICKET_CODE_SECRET', { infer: true })),
    },
  ],
})
export class TicketingModule {}
