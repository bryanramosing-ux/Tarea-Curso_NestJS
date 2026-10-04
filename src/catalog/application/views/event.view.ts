import { Event } from '../../domain/entities/event';

/** Modelo de lectura público del contexto Catálogo. */
export interface EventView {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
  capacity: number;
  price: { amountCents: number; currency: string };
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function toEventView(event: Event): EventView {
  return {
    id: event.id.value,
    name: event.name.value,
    venue: event.venue.value,
    startsAt: event.startsAt.value.toISOString(),
    capacity: event.capacity.value,
    price: { amountCents: event.price.amountCents, currency: event.price.currency },
    status: event.status.value,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}
