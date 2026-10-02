import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, resetDatabase } from './support/test-app';

const UNKNOWN_ID = '6fa459ea-ee8a-4ca4-894e-db77e160355e';

describe('Users (e2e, PostgreSQL real)', () => {
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

  const register = (body: Record<string, unknown>) => http().post('/users').send(body);
  const valid = { name: '  Ana   Pérez ', email: ' ANA@Startup.io ', password: 'secret123' };

  it('runs against the isolated test database', () => {
    expect(dataSource.options.database).toBe(process.env.DB_NAME_TEST);
    expect(dataSource.options.synchronize).toBe(false);
  });

  describe('POST /users', () => {
    it('201: registers a member and normalizes name and email', async () => {
      const created = await register(valid).expect(201);
      expect(created.body).toEqual({ id: expect.any(String) });

      const fetched = await http().get(`/users/${created.body.id}`).expect(200);
      expect(fetched.body).toEqual({
        id: created.body.id,
        name: 'Ana Pérez',
        email: 'ana@startup.io',
        status: 'ACTIVE',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('never returns or stores the password in clear text', async () => {
      const created = await register(valid).expect(201);
      const fetched = await http().get(`/users/${created.body.id}`).expect(200);

      expect(JSON.stringify([created.body, fetched.body])).not.toMatch(/password|hash|secret123/i);
      const [row] = await dataSource.query('SELECT password_hash FROM users WHERE id = $1', [created.body.id]);
      expect(row.password_hash).toMatch(/^scrypt\$/);
      expect(row.password_hash).not.toContain('secret123');
    });

    it('400: rejects a malformed payload at the HTTP edge (DTO + ValidationPipe)', async () => {
      const response = await register({ name: 'Ana' }).expect(400);
      expect(response.body.code).toBe('REQUEST_VALIDATION_FAILED');
      expect(response.body.message).toEqual(expect.arrayContaining([expect.stringContaining('email')]));
    });

    it('400: rejects unknown properties (forbidNonWhitelisted) without echoing values', async () => {
      const response = await register({ ...valid, role: 'admin' }).expect(400);
      expect(response.body.code).toBe('REQUEST_VALIDATION_FAILED');
      expect(response.body.message).toEqual(['property role should not exist']);
      expect(JSON.stringify(response.body)).not.toContain('secret123');
    });

    it('400: domain rules reject a weak password (RN-004) without echoing it', async () => {
      const response = await register({ ...valid, password: 'onlyletters' }).expect(400);
      expect(response.body.code).toBe('USER_WEAK_PASSWORD');
      expect(JSON.stringify(response.body)).not.toContain('onlyletters');
    });

    it('400: domain rules reject an invalid email (RN-001)', async () => {
      const response = await register({ ...valid, email: 'ana-at-startup' }).expect(400);
      expect(response.body.code).toBe('USER_INVALID_EMAIL');
    });

    it('409: the email is unique regardless of casing (RN-002)', async () => {
      await register(valid).expect(201);
      const response = await register({ ...valid, name: 'Otra Ana', email: 'ana@STARTUP.io' }).expect(409);
      expect(response.body.code).toBe('USER_EMAIL_ALREADY_IN_USE');
    });

    it('409: concurrent registrations with the same email are resolved by the UNIQUE constraint', async () => {
      const responses = await Promise.all([register(valid), register(valid), register(valid)]);
      const statuses = responses.map((response) => response.status).sort();

      expect(statuses).toEqual([201, 409, 409]);
      const [{ count }] = await dataSource.query('SELECT COUNT(*)::int AS count FROM users');
      expect(count).toBe(1);
    });
  });

  describe('GET /users/:id', () => {
    it('404: unknown user', async () => {
      const response = await http().get(`/users/${UNKNOWN_ID}`).expect(404);
      expect(response.body).toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
    });

    it('400: malformed id', async () => {
      await http().get('/users/not-a-uuid').expect(400);
    });
  });

  describe('POST /users/:id/deactivate', () => {
    it('204 then 409 when deactivating twice (RN-005)', async () => {
      const { body } = await register(valid).expect(201);

      await http().post(`/users/${body.id}/deactivate`).expect(204);
      expect((await http().get(`/users/${body.id}`).expect(200)).body.status).toBe('INACTIVE');

      const again = await http().post(`/users/${body.id}/deactivate`).expect(409);
      expect(again.body.code).toBe('USER_ALREADY_INACTIVE');
    });

    it('404: unknown user', async () => {
      const response = await http().post(`/users/${UNKNOWN_ID}/deactivate`).expect(404);
      expect(response.body.code).toBe('USER_NOT_FOUND');
    });
  });
});
