import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, resetDatabase } from './support/test-app';

/** Endurecimiento del borde HTTP: cabeceras, formato de errores y entradas hostiles. */
describe('HTTP hardening (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('does not reveal the framework and sends security headers', async () => {
    const response = await http().get('/events').expect(200);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
  });

  it.each([
    ['malformed JSON', () => http().post('/events').set('Content-Type', 'application/json').send('{"name":'), 400, 'BAD_REQUEST'],
    ['non-UUID id', () => http().get('/events/123'), 400, 'REQUEST_VALIDATION_FAILED'],
    ['unknown route', () => http().get('/admin'), 404, 'ROUTE_NOT_FOUND'],
  ])('framework errors share the API error shape: %s', async (_case, send, status, code) => {
    const response = await send().expect(status);
    expect(response.body).toEqual({
      statusCode: status,
      code,
      message: expect.anything(),
      path: expect.any(String),
      timestamp: expect.any(String),
    });
  });

  it('rejects bodies larger than the limit with 413', async () => {
    await http().post('/events').send({ name: 'x'.repeat(200_000) }).expect(413);
  });

  it('ignores __proto__ / constructor payloads without polluting prototypes', async () => {
    const startsAt = new Date(Date.now() + 864e5).toISOString();
    await http()
      .post('/events')
      .set('Content-Type', 'application/json')
      .send(
        `{"name":"Concierto","venue":"Sala Proto","startsAt":"${startsAt}","capacity":10,"priceCents":0,"currency":"USD","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}`,
      )
      .expect(201);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('treats SQL-looking input as plain data', async () => {
    const name = "x'); DROP TABLE events; --";
    const startsAt = new Date(Date.now() + 864e5).toISOString();
    const { body } = await http()
      .post('/events')
      .send({ name, venue: 'Sala SQL', startsAt, capacity: 10, priceCents: 0, currency: 'USD' })
      .expect(201);
    expect((await http().get(`/events/${body.id}`).expect(200)).body.name).toBe(name);
    const [{ count }] = await dataSource.query(`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_name = 'events'`);
    expect(count).toBe(1);
  });
});
