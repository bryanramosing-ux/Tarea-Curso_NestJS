import { INestApplication } from '@nestjs/common';
import request from 'supertest';

let venueCounter = 0;

/** Cabeceras de autenticación del personal (claves de .env, cargado por setup-env.ts). */
export const asOrganizer = () => ({ Authorization: `Bearer ${process.env.ORGANIZER_API_KEY}` });
export const asGate = () => ({ Authorization: `Bearer ${process.env.GATE_API_KEY}` });

const HOUR_MS = 3_600_000;

/** Fecha futura (ISO, sin milisegundos) a `days` días de ahora. */
export function futureDate(days = 30): string {
  return inHours(days * 24);
}

/** Fecha (ISO, sin milisegundos) a `hours` horas de ahora (negativo = pasado). */
export function inHours(hours: number): string {
  return new Date(Date.now() + hours * HOUR_MS).toISOString().replace(/\.\d{3}Z$/, '.000Z');
}

export interface EventInput {
  name?: string;
  venue?: string;
  startsAt?: string;
  capacity?: number;
  priceCents?: number;
  currency?: string;
}

/** Programa un evento por HTTP (como organizador) y devuelve su id. */
export async function scheduleEvent(app: INestApplication, input: EventInput = {}): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/events')
    .set(asOrganizer())
    .send({
      name: input.name ?? 'Rock en el Parque',
      venue: input.venue ?? `Sala ${++venueCounter}`,
      startsAt: input.startsAt ?? futureDate(),
      capacity: input.capacity ?? 100,
      priceCents: input.priceCents ?? 4500,
      currency: input.currency ?? 'PEN',
    })
    .expect(201);
  return response.body.id;
}

/** Cancela un evento por HTTP (como organizador), sin comprobar el estado. */
export function cancelEvent(app: INestApplication, eventId: string) {
  return request(app.getHttpServer()).post(`/events/${eventId}/cancel`).set(asOrganizer());
}

/** Compra entradas por HTTP (público, sin comprobar el estado). */
export function purchase(app: INestApplication, eventId: string, quantity = 1, holderEmail = 'ana@mail.com') {
  return request(app.getHttpServer()).post('/tickets').send({ eventId, quantity, holderName: 'Ana Pérez', holderEmail });
}

/** Check-in en la puerta de `eventId` (como personal de puerta), sin comprobar el estado. */
export function checkIn(app: INestApplication, eventId: string, code: string) {
  return request(app.getHttpServer()).post('/tickets/check-in').set(asGate()).send({ eventId, code });
}
