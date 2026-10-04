import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { futureDate, scheduleEvent } from './support/fixtures';
import { createTestApp, resetDatabase } from './support/test-app';

const UNKNOWN_ID = '6fa459ea-ee8a-4ca4-894e-db77e160355e';

describe('Catalog (e2e, PostgreSQL real)', () => {
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

  const valid = () => ({
    name: '  Rock   en el Parque ',
    venue: 'Estadio Nacional',
    startsAt: futureDate(30),
    capacity: 500,
    priceCents: 4500,
    currency: 'pen',
  });

  it('runs against the isolated test database without synchronize', () => {
    expect(dataSource.options.database).toBe(process.env.DB_NAME_TEST);
    expect(dataSource.options.synchronize).toBe(false);
  });

  describe('POST /events', () => {
    it('201/200: schedules an event and normalizes its data', async () => {
      const body = valid();
      const created = await http().post('/events').send(body).expect(201);
      expect(created.body).toEqual({ id: expect.any(String) });

      const fetched = await http().get(`/events/${created.body.id}`).expect(200);
      expect(fetched.body).toEqual({
        id: created.body.id,
        name: 'Rock en el Parque',
        venue: 'Estadio Nacional',
        startsAt: body.startsAt,
        capacity: 500,
        price: { amountCents: 4500, currency: 'PEN' },
        status: 'SCHEDULED',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('400: malformed payload rejected at the HTTP edge (DTO + ValidationPipe)', async () => {
      const response = await http().post('/events').send({ name: 'Sin datos' }).expect(400);
      expect(response.body.code).toBe('REQUEST_VALIDATION_FAILED');
    });

    it('400: unknown properties are rejected (forbidNonWhitelisted)', async () => {
      const response = await http().post('/events').send({ ...valid(), organizer: 'yo' }).expect(400);
      expect(response.body.message).toEqual(['property organizer should not exist']);
    });

    it.each([
      ['a past date (RN-003)', { startsAt: '2020-01-01T10:00:00Z' }, 'EVENT_START_IN_PAST'],
      ['capacity 0 (RN-004)', { capacity: 0 }, 'EVENT_INVALID_CAPACITY'],
      ['an unsupported currency (RN-005)', { currency: 'BTC' }, 'EVENT_INVALID_PRICE'],
      ['a too short name (RN-001)', { name: 'ab' }, 'EVENT_INVALID_NAME'],
    ])('400: the domain rejects %s', async (_case, patch, code) => {
      const response = await http().post('/events').send({ ...valid(), ...patch }).expect(400);
      expect(response.body.code).toBe(code);
    });

    it('409: the same venue cannot host two events at the same time, ignoring casing (RN-006)', async () => {
      const first = valid();
      await http().post('/events').send(first).expect(201);
      const response = await http()
        .post('/events')
        .send({ ...first, name: 'Otro concierto', venue: 'ESTADIO NACIONAL' })
        .expect(409);
      expect(response.body.code).toBe('EVENT_SLOT_TAKEN');
    });

    it('409: simultaneous bookings of the same slot are resolved by the unique index', async () => {
      const body = valid();
      const responses = await Promise.all([1, 2, 3].map(() => http().post('/events').send(body)));
      expect(responses.map((response) => response.status).sort()).toEqual([201, 409, 409]);
      const [{ count }] = await dataSource.query('SELECT COUNT(*)::int AS count FROM events');
      expect(count).toBe(1);
    });
  });

  describe('GET /events', () => {
    it('200: lists by start date and filters by status', async () => {
      const late = await scheduleEvent(app, { name: 'Tarde', startsAt: futureDate(60) });
      const early = await scheduleEvent(app, { name: 'Temprano', startsAt: futureDate(10) });
      await http().post(`/events/${late}/cancel`).expect(204);

      const all = await http().get('/events').expect(200);
      expect(all.body.map((event: { id: string }) => event.id)).toEqual([early, late]);

      const cancelled = await http().get('/events').query({ status: 'CANCELLED' }).expect(200);
      expect(cancelled.body.map((event: { id: string }) => event.id)).toEqual([late]);
    });

    it('400: unknown status filter', async () => {
      expect((await http().get('/events').query({ status: 'POSTPONED' }).expect(400)).body.code).toBe(
        'EVENT_INVALID_STATUS',
      );
    });

    it('404 / 400: unknown or malformed id', async () => {
      expect((await http().get(`/events/${UNKNOWN_ID}`).expect(404)).body.code).toBe('EVENT_NOT_FOUND');
      await http().get('/events/123').expect(400);
    });
  });

  describe('POST /events/:id/cancel (RN-007)', () => {
    it('204 then 409 when cancelling twice', async () => {
      const id = await scheduleEvent(app);
      await http().post(`/events/${id}/cancel`).expect(204);
      expect((await http().get(`/events/${id}`).expect(200)).body.status).toBe('CANCELLED');
      expect((await http().post(`/events/${id}/cancel`).expect(409)).body.code).toBe('EVENT_ALREADY_CANCELLED');
    });

    it('404: unknown event', async () => {
      expect((await http().post(`/events/${UNKNOWN_ID}/cancel`).expect(404)).body.code).toBe('EVENT_NOT_FOUND');
    });
  });
});
