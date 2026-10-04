import { Command } from '@nestjs/cqrs';

export interface PurchaseTicketsResult {
  eventId: string;
  /** Los códigos se muestran UNA sola vez (RN-012): después solo se guarda su hash. */
  tickets: { id: string; code: string }[];
  total: { amountCents: number; currency: string };
}

/** Caso de uso de escritura: comprar entradas para un evento. */
export class PurchaseTicketsCommand extends Command<PurchaseTicketsResult> {
  constructor(
    public readonly eventId: string,
    public readonly quantity: number,
    public readonly holderName: string,
    public readonly holderEmail: string,
  ) {
    super();
  }
}
