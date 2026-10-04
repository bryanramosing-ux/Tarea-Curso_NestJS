import { Logger } from '@nestjs/common';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { EventCancelled } from '../../../catalog/domain/events/event-cancelled.event';
import { CloseEventSalesCommand } from '../../application/commands/close-event-sales/close-event-sales.command';

/**
 * Oyente EXTERNO (vive en infraestructura de la venta): reacciona a un hecho
 * publicado por el contexto Catálogo y lo traduce a un comando propio.
 * Solo depende de la clase del evento (contrato publicado), nunca de la
 * entidad ni de los value objects del catálogo. RN-014.
 */
@EventsHandler(EventCancelled)
export class CloseSalesOnEventCancelledListener implements IEventHandler<EventCancelled> {
  private readonly logger = new Logger(CloseSalesOnEventCancelledListener.name);

  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: EventCancelled): Promise<void> {
    try {
      const result = await this.commandBus.execute(new CloseEventSalesCommand(event.eventId));
      this.logger.log(`Sales closed for cancelled event ${event.eventId}; refunded ${result.refundedTicketIds.length} ticket(s)`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Could not close sales of cancelled event ${event.eventId}: ${reason}`);
    }
  }
}
