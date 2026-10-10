import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { asGate, asOrganizer, cancelEvent, futureDate, scheduleEvent } from './support/fixtures';
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
      const created = await http().post('/events').set(asOrganizer()).send(body).expect(201);
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
      const response = await http().post('/events').set(asOrganizer()).send({ name: 'Sin datos' }).expect(400);
      expect(response.body.code).toBe('REQUEST_VALIDATION_FAILED');
    });

    it('400: unknown properties are rejected (forbidNonWhitelisted)', async () => {
      const response = await http().post('/events').set(asOrganizer()).send({ ...valid(), organizer: 'yo' }).expect(400);
      expect(response.body.message).toEqual(['property organizer should not exist']);
    });

    it.each([
      ['a past date (RN-003)', { startsAt: '2020-01-01T10:00:00Z' }, 'EVENT_START_IN_PAST'],
      ['capacity 0 (RN-004)', { capacity: 0 }, 'EVENT_INVALID_CAPACITY'],
      ['an unsupported currency (RN-005)', { currency: 'BTC' }, 'EVENT_INVALID_PRICE'],
      ['a too short name (RN-001)', { name: 'ab' }, 'EVENT_INVALID_NAME'],
    ])('400: the domain rejects %s', async (_case, patch, code) => {
      const response = await http().post('/events').set(asOrganizer()).send({ ...valid(), ...patch }).expect(400);
      expect(response.body.code).toBe(code);
    });

    it('409: the same venue cannot host two events at the same time, ignoring casing (RN-006)', async () => {
      const first = valid();
      await http().post('/events').set(asOrganizer()).send(first).expect(201);
      const response = await http()
        .post('/events')
        .set(asOrganizer())
        .send({ ...first, name: 'Otro concierto', venue: 'ESTADIO NACIONAL' })
        .expect(409);
      expect(response.body.code).toBe('EVENT_SLOT_TAKEN');
    });

    it('409: the same venue written with a decomposed accent is the same venue (Unicode NFC)', async () => {
      const first = { ...valid(), venue: 'Caf\u00e9 Teatro' };
      await http().post('/events').set(asOrganizer()).send(first).expect(201);
      const response = await http()
        .post('/events')
        .set(asOrganizer())
        .send({ ...first, venue: 'CAFE\u0301 TEATRO' })
        .expect(409);
      expect(response.body.code).toBe('EVENT_SLOT_TAKEN');
    });

    it('401 without a key and 403 with the gate key: only the organizer schedules events', async () => {
      expect((await http().post('/events').send(valid()).expect(401)).body.code).toBe('UNAUTHORIZED');
      expect((await http().post('/events').set(asGate()).send(valid()).expect(403)).body.code).toBe('FORBIDDEN');
    });

    it('409: simultaneous bookings of the same slot are resolved by the unique index', async () => {
      const body = valid();
      const responses = await Promise.all([1, 2, 3].map(() => http().post('/events').set(asOrganizer()).send(body)));
      expect(responses.map((response) => response.status).sort()).toEqual([201, 409, 409]);
      const [{ count }] = await dataSource.query('SELECT COUNT(*)::int AS count FROM events');
      expect(count).toBe(1);
    });
  });

  describe('GET /events', () => {
    const ids = (page: { items: { id: string }[] }) => page.items.map((event) => event.id);

    it('200: lists by start date and filters by status (public, no key)', async () => {
      const late = await scheduleEvent(app, { name: 'Tarde', startsAt: futureDate(60) });
      const early = await scheduleEvent(app, { name: 'Temprano', startsAt: futureDate(10) });
      await cancelEvent(app, late).expect(204);

      const all = await http().get('/events').expect(200);
      expect(ids(all.body)).toEqual([early, late]);
      expect(all.body).toMatchObject({ limit: 20, offset: 0, nextOffset: null });

      const cancelled = await http().get('/events').query({ status: 'CANCELLED' }).expect(200);
      expect(ids(cancelled.body)).toEqual([late]);
    });

    it('200: paginates with limit and offset', async () => {
      const created = [];
      for (let day = 1; day <= 5; day++) {
        created.push(await scheduleEvent(app, { startsAt: futureDate(day) }));
      }

      const first = await http().get('/events').query({ limit: 2 }).expect(200);
      expect(ids(first.body)).toEqual(created.slice(0, 2));
      expect(first.body.nextOffset).toBe(2);

      const last = await http().get('/events').query({ limit: 2, offset: 4 }).expect(200);
      expect(ids(last.body)).toEqual(created.slice(4));
      expect(last.body.nextOffset).toBeNull();
    });

    it.each([{ limit: 0 }, { limit: 101 }, { offset: -1 }, { limit: 'abc' }])('400: invalid pagination %p', async (query) => {
      expect((await http().get('/events').query(query).expect(400)).body.code).toBe('REQUEST_VALIDATION_FAILED');
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
      await cancelEvent(app, id).expect(204);
      expect((await http().get(`/events/${id}`).expect(200)).body.status).toBe('CANCELLED');
      expect((await cancelEvent(app, id).expect(409)).body.code).toBe('EVENT_ALREADY_CANCELLED');
    });

    it('404: unknown event', async () => {
      expect((await cancelEvent(app, UNKNOWN_ID).expect(404)).body.code).toBe('EVENT_NOT_FOUND');
    });

    it('401: cancelling requires the organizer key', async () => {
      const id = await scheduleEvent(app);
      await http().post(`/events/${id}/cancel`).expect(401);
      expect((await http().get(`/events/${id}`).expect(200)).body.status).toBe('SCHEDULED');
    });
  });
});
