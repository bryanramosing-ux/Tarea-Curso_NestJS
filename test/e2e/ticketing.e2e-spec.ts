import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { purchase, scheduleEvent } from './support/fixtures';
import { createTestApp, eventually, resetDatabase } from './support/test-app';

const UNKNOWN_ID = '6fa459ea-ee8a-4ca4-894e-db77e160355e';

describe('Ticketing (e2e, PostgreSQL real)', () => {
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

  const checkIn = (code: string) => http().post('/tickets/check-in').send({ code });
  const ticket = async (id: string) => (await http().get(`/tickets/${id}`).expect(200)).body;

  describe('POST /tickets (purchase)', () => {
    it('201: issues the tickets, charges price × quantity and returns each code once (RN-015)', async () => {
      const eventId = await scheduleEvent(app, { capacity: 10, priceCents: 4500, currency: 'PEN' });

      const response = await purchase(app, eventId, 2, ' ANA@Mail.com ').expect(201);

      expect(response.body).toEqual({
        eventId,
        tickets: [
          { id: expect.any(String), code: expect.stringMatching(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/) },
          { id: expect.any(String), code: expect.stringMatching(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/) },
        ],
        total: { amountCents: 9000, currency: 'PEN' },
      });
      expect(await ticket(response.body.tickets[0].id)).toMatchObject({
        eventId,
        holderEmail: 'ana@mail.com',
        status: 'ISSUED',
        price: { amountCents: 4500, currency: 'PEN' },
      });
    });

    it('never stores or returns the code again: only its HMAC is in the database (RN-012)', async () => {
      const eventId = await scheduleEvent(app);
      const { body } = await purchase(app, eventId, 1).expect(201);
      const [{ id, code }] = body.tickets;

      expect(JSON.stringify(await ticket(id))).not.toMatch(new RegExp(`${code}|code|hash`, 'i'));
      const [row] = await dataSource.query('SELECT code_hash FROM tickets WHERE id = $1', [id]);
      expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
      const [{ count }] = await dataSource.query(
        `SELECT COUNT(*)::int AS count FROM tickets t WHERE row_to_json(t)::text LIKE $1`,
        [`%${code}%`],
      );
      expect(count).toBe(0);
    });

    it('400: the DTO rejects a malformed payload', async () => {
      const response = await http().post('/tickets').send({ eventId: 'nope', quantity: '2' }).expect(400);
      expect(response.body.code).toBe('REQUEST_VALIDATION_FAILED');
    });

    it.each([
      ['more than 10 tickets (RN-008)', { quantity: 11 }, 'TICKET_INVALID_QUANTITY'],
      ['an invalid email (RN-011)', { holderEmail: 'ana-at-mail' }, 'TICKET_INVALID_HOLDER_EMAIL'],
    ])('400: the domain rejects %s', async (_case, patch, code) => {
      const eventId = await scheduleEvent(app);
      const response = await http()
        .post('/tickets')
        .send({ eventId, quantity: 1, holderName: 'Ana', holderEmail: 'ana@mail.com', ...patch })
        .expect(400);
      expect(response.body.code).toBe(code);
    });

    it('404: the event does not exist', async () => {
      expect((await purchase(app, UNKNOWN_ID).expect(404)).body.code).toBe('TICKET_EVENT_NOT_FOUND');
    });

    it('409: never sells beyond the capacity (RN-009)', async () => {
      const eventId = await scheduleEvent(app, { capacity: 3 });
      await purchase(app, eventId, 2).expect(201);

      const response = await purchase(app, eventId, 2).expect(409);

      expect(response.body.code).toBe('TICKET_NOT_ENOUGH_AVAILABLE');
      expect((await http().get(`/tickets/availability/${eventId}`).expect(200)).body).toMatchObject({
        capacity: 3,
        sold: 2,
        available: 1,
        salesOpen: true,
      });
    });

    it('409: a cancelled event does not sell tickets (RN-010)', async () => {
      const eventId = await scheduleEvent(app);
      await http().post(`/events/${eventId}/cancel`).expect(204);
      expect((await purchase(app, eventId).expect(409)).body.code).toBe('TICKET_SALES_CLOSED');
    });
  });

  describe('POST /tickets/check-in (RN-013)', () => {
    it('200 once, then 409 TICKET_ALREADY_USED', async () => {
      const eventId = await scheduleEvent(app);
      const [{ id, code }] = (await purchase(app, eventId).expect(201)).body.tickets;

      expect((await checkIn(code.toLowerCase()).expect(200)).body).toEqual({ id });
      expect(await ticket(id)).toMatchObject({ status: 'USED', usedAt: expect.any(String) });
      expect((await checkIn(code).expect(409)).body.code).toBe('TICKET_ALREADY_USED');
    });

    it('404: unknown code / 400: malformed code', async () => {
      expect((await checkIn('AAAA-BBBB-CCCC').expect(404)).body.code).toBe('TICKET_NOT_FOUND');
      expect((await checkIn('hola').expect(400)).body.code).toBe('TICKET_INVALID_CODE');
    });
  });

  describe('GET /tickets/:id and /tickets/availability/:eventId', () => {
    it('404 / 400 for unknown or malformed ids', async () => {
      expect((await http().get(`/tickets/${UNKNOWN_ID}`).expect(404)).body.code).toBe('TICKET_NOT_FOUND');
      await http().get('/tickets/123').expect(400);
      expect((await http().get(`/tickets/availability/${UNKNOWN_ID}`).expect(404)).body.code).toBe(
        'TICKET_EVENT_NOT_FOUND',
      );
    });

    it('200: availability before any sale comes from the catalog', async () => {
      const eventId = await scheduleEvent(app, { capacity: 7, priceCents: 0, currency: 'USD' });
      expect((await http().get(`/tickets/availability/${eventId}`).expect(200)).body).toEqual({
        eventId,
        capacity: 7,
        sold: 0,
        available: 7,
        salesOpen: true,
        price: { amountCents: 0, currency: 'USD' },
      });
    });
  });

  describe('cross-context event: EventCancelled -> close sales and refund (RN-014)', () => {
    it('refunds unused tickets, keeps used ones and closes the sales', async () => {
      const eventId = await scheduleEvent(app);
      const [used, unused] = (await purchase(app, eventId, 2).expect(201)).body.tickets;
      await checkIn(used.code).expect(200);

      await http().post(`/events/${eventId}/cancel`).expect(204);

      const refunded = await eventually(
        () => ticket(unused.id),
        (view) => view.status === 'REFUNDED',
      );
      expect(refunded.status).toBe('REFUNDED');
      expect((await ticket(used.id)).status).toBe('USED');
      expect((await http().get(`/tickets/availability/${eventId}`).expect(200)).body.salesOpen).toBe(false);
      expect((await checkIn(unused.code).expect(409)).body.code).toBe('TICKET_REFUNDED');
    });
  });

  describe('database constraints created by the migrations', () => {
    it('CHECK ck_ticket_allocations_sold forbids overselling even outside the app (RN-009)', async () => {
      const eventId = await scheduleEvent(app, { capacity: 2 });
      await purchase(app, eventId, 1).expect(201);
      await expect(
        dataSource.query('UPDATE ticket_allocations SET sold = 3 WHERE event_id = $1', [eventId]),
      ).rejects.toThrow(/ck_ticket_allocations_sold/);
    });

    it('CHECK ck_tickets_used_at keeps status and check-in date consistent (RN-013)', async () => {
      const eventId = await scheduleEvent(app);
      const [{ id }] = (await purchase(app, eventId).expect(201)).body.tickets;
      await expect(dataSource.query(`UPDATE tickets SET status = 'USED' WHERE id = $1`, [id])).rejects.toThrow(
        /ck_tickets_used_at/,
      );
    });

    it('FK fk_tickets_event rejects tickets for events that do not exist', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO tickets (id, event_id, holder_name, holder_email, code_hash, price_cents, currency, status, purchased_at, updated_at)
           VALUES ($1, $2, 'Ana', 'ana@mail.com', repeat('a', 64), 0, 'USD', 'ISSUED', now(), now())`,
          [UNKNOWN_ID, UNKNOWN_ID],
        ),
      ).rejects.toThrow(/fk_tickets_event/);
    });
  });
});
