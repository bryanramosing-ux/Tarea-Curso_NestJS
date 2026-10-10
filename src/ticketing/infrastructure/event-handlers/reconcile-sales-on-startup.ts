import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ReconcileSalesCommand, ReconcileSalesResult } from '../../application/commands/reconcile-sales/reconcile-sales.command';

/**
 * Al arrancar, concilia la venta con el catálogo: si el proceso cayó entre
 * cancelar un evento y cerrar su venta (el EventBus es en memoria y ese hecho
 * se pierde), aquí se completa RN-014. No impide arrancar si falla.
 */
@Injectable()
export class ReconcileSalesOnStartup implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReconcileSalesOnStartup.name);

  constructor(private readonly commandBus: CommandBus) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const result: ReconcileSalesResult = await this.commandBus.execute(new ReconcileSalesCommand());
      if (result.closedEventIds.length > 0) {
        this.logger.warn(`Reconciliation closed the sales of ${result.closedEventIds.length} cancelled event(s)`);
      }
    } catch (error) {
      this.logger.error(`Sales reconciliation failed on startup: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
