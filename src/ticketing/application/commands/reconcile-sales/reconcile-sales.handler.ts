import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EVENT_CATALOG, EventCatalog } from '../../../domain/ports/event-catalog.port';
import { TICKET_ALLOCATION_REPOSITORY, TicketAllocationRepository } from '../../../domain/ports/ticket-allocation.repository';
import { EventReference } from '../../../domain/value-objects/event-reference';
import { CloseEventSalesCommand } from '../close-event-sales/close-event-sales.command';
import { ReconcileSalesCommand, ReconcileSalesResult } from './reconcile-sales.command';

/** Cupos abiertos que se revisan por lote. */
export const RECONCILE_BATCH_SIZE = 100;

/**
 * Recorre los cupos con la venta abierta (por lotes, paginando por evento) y,
 * para cada evento que el catálogo ya canceló, DELEGA en el caso de uso
 * CloseEventSales (que es idempotente). No guarda ni publica nada por sí mismo:
 * toda la escritura la hace ese caso de uso.
 */
@CommandHandler(ReconcileSalesCommand)
export class ReconcileSalesHandler implements ICommandHandler<ReconcileSalesCommand> {
  constructor(
    @Inject(TICKET_ALLOCATION_REPOSITORY) private readonly allocations: TicketAllocationRepository,
    @Inject(EVENT_CATALOG) private readonly catalog: EventCatalog,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(_command: ReconcileSalesCommand): Promise<ReconcileSalesResult> {
    const closedEventIds: string[] = [];
    let after: EventReference | undefined;
    for (let batch = await this.allocations.findOpen(RECONCILE_BATCH_SIZE); batch.length > 0; ) {
      for (const allocation of batch) {
        const event = await this.catalog.findEvent(allocation.eventId);
        if (event?.isCancelled()) {
          await this.commandBus.execute(new CloseEventSalesCommand(allocation.eventId.value));
          closedEventIds.push(allocation.eventId.value);
        }
      }
      after = batch[batch.length - 1].eventId;
      batch = await this.allocations.findOpen(RECONCILE_BATCH_SIZE, after);
    }
    return { closedEventIds };
  }
}
