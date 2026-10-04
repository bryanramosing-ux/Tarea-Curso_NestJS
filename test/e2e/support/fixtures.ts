import { INestApplication } from '@nestjs/common';
import request from 'supertest';

let venueCounter = 0;

/** Fecha futura (ISO, sin milisegundos) a `days` días de hoy. */
export function futureDate(days = 30): string {
  return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, '.000Z');
}

export interface EventInput {
  name?: string;
  venue?: string;
  startsAt?: string;
  capacity?: number;
  priceCents?: number;
  currency?: string;
}

/** Programa un evento por HTTP y devuelve su id. */
export async function scheduleEvent(app: INestApplication, input: EventInput = {}): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/events')
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

/** Compra entradas por HTTP (sin comprobar el estado). */
export function purchase(app: INestApplication, eventId: string, quantity = 1, holderEmail = 'ana@mail.com') {
  return request(app.getHttpServer()).post('/tickets').send({ eventId, quantity, holderName: 'Ana Pérez', holderEmail });
}
