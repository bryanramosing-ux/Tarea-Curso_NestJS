import { Command } from '@nestjs/cqrs';

export interface ReconcileSalesResult {
  /** Eventos cancelados cuya venta seguía abierta y se cerró ahora. */
  closedEventIds: string[];
}

/**
 * Caso de uso de escritura: conciliar la venta con el catálogo. Busca cupos
 * con la venta abierta cuyo evento ya fue cancelado (porque el cierre
 * automático por evento falló o se perdió) y les aplica RN-014.
 * Se ejecuta al arrancar la aplicación y bajo demanda (organizador).
 */
export class ReconcileSalesCommand extends Command<ReconcileSalesResult> {}
