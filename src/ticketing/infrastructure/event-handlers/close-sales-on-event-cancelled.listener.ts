import { Logger } from '@nestjs/common';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { EventCancelled } from '../../../catalog/domain/events/event-cancelled.event';
import { CloseEventSalesCommand } from '../../application/commands/close-event-sales/close-event-sales.command';

/** Intentos del cierre automático antes de dejarlo a la conciliación. */
export const CLOSE_SALES_LISTENER_ATTEMPTS = 3;
/** Espera base entre intentos (se duplica en cada uno: 200 ms, 400 ms...). */
export const CLOSE_SALES_LISTENER_BASE_DELAY_MS = 200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Oyente EXTERNO (vive en infraestructura de la venta): reacciona a un hecho
 * publicado por el contexto Catálogo y lo traduce a un comando propio.
 * Solo depende de la clase del evento (contrato publicado), nunca de la
 * entidad ni de los value objects del catálogo. RN-014.
 * Si falla (p. ej. la base no responde), reintenta con espera creciente; si
 * aun así falla, lo registra: la conciliación (ReconcileSales) lo cerrará al
 * siguiente arranque o cuando el organizador la lance. Mientras tanto, la
 * compra y el check-in ya rechazan el evento porque consultan el catálogo.
 */
@EventsHandler(EventCancelled)
export class CloseSalesOnEventCancelledListener implements IEventHandler<EventCancelled> {
  private readonly logger = new Logger(CloseSalesOnEventCancelledListener.name);

  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: EventCancelled): Promise<void> {
    for (let attempt = 1; attempt <= CLOSE_SALES_LISTENER_ATTEMPTS; attempt++) {
      try {
        const result = await this.commandBus.execute(new CloseEventSalesCommand(event.eventId));
        this.logger.log(`Sales closed for cancelled event ${event.eventId}; refunded ${result.refundedTicketIds.length} ticket(s)`);
        return;
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        if (attempt === CLOSE_SALES_LISTENER_ATTEMPTS) {
          this.logger.error(
            `Could not close sales of cancelled event ${event.eventId} after ${attempt} attempt(s): ${reason}. ` +
              'It will be retried by the sales reconciliation (on startup or POST /tickets/sales/reconcile).',
          );
          return;
        }
        this.logger.warn(`Closing sales of cancelled event ${event.eventId} failed (attempt ${attempt}): ${reason}; retrying`);
        await wait(CLOSE_SALES_LISTENER_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }
}
