import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * Límite de peticiones por IP (429). Este archivo arranca su propia app con
 * límites BAJOS: se fijan antes de cargar AppModule (ConfigModule lee
 * process.env al importarse) y Jest aísla los módulos de cada archivo.
 */
describe('Rate limiting (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.THROTTLE_TTL_SECONDS = '60';
    process.env.THROTTLE_LIMIT = '8';
    process.env.THROTTLE_SENSITIVE_LIMIT = '3';
    const { createTestApp } = await import('./support/test-app');
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
    process.env.THROTTLE_LIMIT = '100000';
    process.env.THROTTLE_SENSITIVE_LIMIT = '100000';
  });

  it('sensitive routes (purchase) answer 429 after THROTTLE_SENSITIVE_LIMIT requests per window', async () => {
    const attempt = () => http().post('/tickets').send({ eventId: 'not-a-uuid', quantity: 1, holderName: 'Ana', holderEmail: 'a@b.io' });
    for (let i = 0; i < 3; i++) {
      await attempt().expect(400);
    }
    const blocked = await attempt().expect(429);
    expect(blocked.body).toMatchObject({ statusCode: 429, code: 'TOO_MANY_REQUESTS' });
    expect(blocked.headers['retry-after-sensitive'] ?? blocked.headers['retry-after']).toBeDefined();
  });

  it('every other route answers 429 after THROTTLE_LIMIT requests per window (counted per route and IP)', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) {
      statuses.push((await http().get('/events')).status);
    }
    expect(statuses).toEqual([...Array(8).fill(200), 429, 429]);
  });
});
