/** Modelo de lectura: cuántas entradas quedan para un evento. */
export interface AvailabilityView {
  eventId: string;
  capacity: number;
  sold: number;
  available: number;
  salesOpen: boolean;
  price: { amountCents: number; currency: string };
}
