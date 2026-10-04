import { Ticket } from '../../domain/entities/ticket';

/**
 * Modelo de lectura de una entrada. NUNCA incluye el código secreto ni su
 * hash: el código solo se entrega una vez, en la respuesta de la compra.
 */
export interface TicketView {
  id: string;
  eventId: string;
  holderName: string;
  holderEmail: string;
  status: string;
  price: { amountCents: number; currency: string };
  purchasedAt: string;
  usedAt: string | null;
}

export function toTicketView(ticket: Ticket): TicketView {
  return {
    id: ticket.id.value,
    eventId: ticket.eventId.value,
    holderName: ticket.holderName.value,
    holderEmail: ticket.holderEmail.value,
    status: ticket.status.value,
    price: { amountCents: ticket.price.amountCents, currency: ticket.price.currency },
    purchasedAt: ticket.purchasedAt.toISOString(),
    usedAt: ticket.usedAt?.toISOString() ?? null,
  };
}
