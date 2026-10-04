import { Command } from '@nestjs/cqrs';

export interface CloseEventSalesResult {
  refundedTicketIds: string[];
}

/**
 * Caso de uso de escritura interno (sin endpoint): cerrar la venta de un
 * evento cancelado y reembolsar sus entradas no usadas (RN-014).
 * Lo dispara el oyente del evento EventCancelled del contexto Catálogo.
 */
export class CloseEventSalesCommand extends Command<CloseEventSalesResult> {
  constructor(public readonly eventId: string) {
    super();
  }
}
