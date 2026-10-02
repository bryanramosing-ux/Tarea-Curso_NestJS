import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, eventually, resetDatabase } from './support/test-app';

const UNKNOWN_ID = '6fa459ea-ee8a-4ca4-894e-db77e160355e';

describe('Tasks (e2e, PostgreSQL real)', () => {
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

  async function createMember(email = 'ana@startup.io'): Promise<string> {
    const response = await http().post('/users').send({ name: 'Ana', email, password: 'secret123' }).expect(201);
    return response.body.id;
  }

  async function createTask(body: Record<string, unknown> = { title: 'Preparar demo' }): Promise<string> {
    const response = await http().post('/tasks').send(body).expect(201);
    return response.body.id;
  }

  const assign = (taskId: string, assigneeId: string) =>
    http().patch(`/tasks/${taskId}/assignee`).send({ assigneeId });
  const move = (taskId: string, status: string) => http().patch(`/tasks/${taskId}/status`).send({ status });
  const getTask = async (taskId: string) => (await http().get(`/tasks/${taskId}`).expect(200)).body;

  describe('POST /tasks + GET /tasks/:id', () => {
    it('201/200: creates a TODO task with defaults (RN-008)', async () => {
      const id = await createTask({ title: '  Preparar   demo ', description: ' Para inversores ' });

      expect(await getTask(id)).toEqual({
        id,
        title: 'Preparar demo',
        description: 'Para inversores',
        status: 'TODO',
        priority: 'MEDIUM',
        assigneeId: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('400: missing title is rejected by the DTO', async () => {
      const response = await http().post('/tasks').send({ description: 'x' }).expect(400);
      expect(response.body.code).toBe('REQUEST_VALIDATION_FAILED');
    });

    it('400: a too short title is rejected by the domain (RN-006)', async () => {
      const response = await http().post('/tasks').send({ title: 'ab' }).expect(400);
      expect(response.body.code).toBe('TASK_INVALID_TITLE');
    });

    it('400: an unknown priority is rejected by the domain (RN-014)', async () => {
      const response = await http().post('/tasks').send({ title: 'Preparar demo', priority: 'URGENT' }).expect(400);
      expect(response.body.code).toBe('TASK_INVALID_PRIORITY');
    });

    it('404: unknown task / 400: malformed id', async () => {
      const response = await http().get(`/tasks/${UNKNOWN_ID}`).expect(404);
      expect(response.body.code).toBe('TASK_NOT_FOUND');
      await http().get('/tasks/123').expect(400);
    });
  });

  describe('PATCH /tasks/:id/assignee (RN-011)', () => {
    it('204: assigns an active member', async () => {
      const [taskId, memberId] = [await createTask(), await createMember()];
      await assign(taskId, memberId).expect(204);
      expect((await getTask(taskId)).assigneeId).toBe(memberId);
    });

    it('404: the member does not exist', async () => {
      const taskId = await createTask();
      const response = await assign(taskId, UNKNOWN_ID).expect(404);
      expect(response.body.code).toBe('TASK_ASSIGNEE_NOT_FOUND');
    });

    it('404: the task does not exist', async () => {
      const response = await assign(UNKNOWN_ID, await createMember()).expect(404);
      expect(response.body.code).toBe('TASK_NOT_FOUND');
    });

    it('409: the member is inactive', async () => {
      const [taskId, memberId] = [await createTask(), await createMember()];
      await http().post(`/users/${memberId}/deactivate`).expect(204);

      const response = await assign(taskId, memberId).expect(409);
      expect(response.body.code).toBe('TASK_ASSIGNEE_INACTIVE');
    });

    it('400: assigneeId must be a uuid', async () => {
      const taskId = await createTask();
      const response = await assign(taskId, 'ana').expect(400);
      expect(response.body.code).toBe('REQUEST_VALIDATION_FAILED');
    });
  });

  describe('PATCH /tasks/:id/status (RN-009, RN-010, RN-012)', () => {
    it('409: cannot start a task without an assignee', async () => {
      const taskId = await createTask();
      const response = await move(taskId, 'IN_PROGRESS').expect(409);
      expect(response.body.code).toBe('TASK_REQUIRES_ASSIGNEE');
    });

    it('204: walks the whole Kanban flow, then DONE is final', async () => {
      const [taskId, memberId] = [await createTask(), await createMember()];
      await assign(taskId, memberId).expect(204);

      await move(taskId, 'IN_PROGRESS').expect(204);
      await move(taskId, 'IN_REVIEW').expect(204);
      await move(taskId, 'DONE').expect(204);
      expect((await getTask(taskId)).status).toBe('DONE');

      expect((await move(taskId, 'IN_PROGRESS').expect(409)).body.code).toBe('TASK_ALREADY_DONE');
      expect((await assign(taskId, await createMember('luis@startup.io')).expect(409)).body.code).toBe(
        'TASK_ALREADY_DONE',
      );
    });

    it('409: cannot skip columns', async () => {
      const [taskId, memberId] = [await createTask(), await createMember()];
      await assign(taskId, memberId).expect(204);
      await move(taskId, 'IN_PROGRESS').expect(204);

      const response = await move(taskId, 'DONE').expect(409);
      expect(response.body.code).toBe('TASK_INVALID_STATUS_TRANSITION');
      expect((await getTask(taskId)).status).toBe('IN_PROGRESS');
    });

    it('400: unknown status value', async () => {
      const response = await move(await createTask(), 'BLOCKED').expect(400);
      expect(response.body.code).toBe('TASK_INVALID_STATUS');
    });
  });

  describe('GET /tasks', () => {
    it('200: lists the board and filters by status and assignee', async () => {
      const memberId = await createMember();
      const first = await createTask({ title: 'Primera' });
      const second = await createTask({ title: 'Segunda', priority: 'high' });
      await assign(second, memberId).expect(204);
      await move(second, 'IN_PROGRESS').expect(204);

      const all = await http().get('/tasks').expect(200);
      expect(all.body.map((task: { id: string }) => task.id)).toEqual([first, second]);

      const inProgress = await http().get('/tasks').query({ status: 'IN_PROGRESS' }).expect(200);
      expect(inProgress.body).toEqual([expect.objectContaining({ id: second, priority: 'HIGH' })]);

      const mine = await http().get('/tasks').query({ assigneeId: memberId }).expect(200);
      expect(mine.body.map((task: { id: string }) => task.id)).toEqual([second]);
    });

    it('400: invalid filters', async () => {
      expect((await http().get('/tasks').query({ status: 'BLOCKED' }).expect(400)).body.code).toBe(
        'TASK_INVALID_STATUS',
      );
      await http().get('/tasks').query({ assigneeId: 'nope' }).expect(400);
      await http().get('/tasks').query({ unknown: 'x' }).expect(400);
    });
  });

  describe('cross-context event: UserDeactivated -> release tasks (RN-013)', () => {
    it('unassigns the unfinished tasks of a deactivated member and moves them back to TODO', async () => {
      const ana = await createMember();
      const inProgress = await createTask({ title: 'En curso' });
      const done = await createTask({ title: 'Terminada' });
      for (const taskId of [inProgress, done]) {
        await assign(taskId, ana).expect(204);
        await move(taskId, 'IN_PROGRESS').expect(204);
      }
      await move(done, 'IN_REVIEW').expect(204);
      await move(done, 'DONE').expect(204);

      await http().post(`/users/${ana}/deactivate`).expect(204);

      const released = await eventually(
        () => getTask(inProgress),
        (task) => task.assigneeId === null,
      );
      expect(released).toMatchObject({ status: 'TODO', assigneeId: null });
      expect(await getTask(done)).toMatchObject({ status: 'DONE', assigneeId: ana });
    });
  });

  describe('database constraints created by the migrations', () => {
    it('CHECK ck_tasks_assignee_required rejects a started task without assignee (RN-010)', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO tasks (id, title, description, status, priority, assignee_id, created_at, updated_at)
           VALUES ($1, 'Tarea', '', 'IN_PROGRESS', 'LOW', NULL, now(), now())`,
          [UNKNOWN_ID],
        ),
      ).rejects.toThrow(/ck_tasks_assignee_required/);
    });

    it('FK fk_tasks_assignee rejects an assignee that is not a user (RN-011)', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO tasks (id, title, description, status, priority, assignee_id, created_at, updated_at)
           VALUES ($1, 'Tarea', '', 'TODO', 'LOW', $2, now(), now())`,
          [UNKNOWN_ID, UNKNOWN_ID],
        ),
      ).rejects.toThrow(/fk_tasks_assignee/);
    });
  });
});
