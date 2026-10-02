import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Task } from '../../src/tasks/domain/entities/task';
import { TaskConcurrentModificationError } from '../../src/tasks/domain/errors/task.errors';
import { TASK_REPOSITORY, TaskRepository } from '../../src/tasks/domain/ports/task.repository';
import { AssigneeId } from '../../src/tasks/domain/value-objects/assignee-id';
import { TaskId } from '../../src/tasks/domain/value-objects/task-id';
import { TaskStatus } from '../../src/tasks/domain/value-objects/task-status';
import { TaskTitle } from '../../src/tasks/domain/value-objects/task-title';
import { TeamMember } from '../../src/tasks/domain/value-objects/team-member';
import { UserConcurrentModificationError } from '../../src/users/domain/errors/user.errors';
import { USER_REPOSITORY, UserRepository } from '../../src/users/domain/ports/user.repository';
import { UserId } from '../../src/users/domain/value-objects/user-id';
import { createTestApp, resetDatabase } from './support/test-app';

/**
 * Regresión del bug de "actualizaciones perdidas": antes, dos operaciones que
 * leían la misma fila y la guardaban después se sobrescribían en silencio.
 * Se usa el adaptador REAL (TypeORM + PostgreSQL) obtenido del contenedor de Nest.
 */
describe('Optimistic locking (e2e, PostgreSQL real)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let tasks: TaskRepository;
  let users: UserRepository;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    tasks = app.get<TaskRepository>(TASK_REPOSITORY);
    users = app.get<UserRepository>(USER_REPOSITORY);
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  async function memberId(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Ana', email: 'ana@startup.io', password: 'secret123' })
      .expect(201);
    return response.body.id;
  }

  it('a stale task copy cannot undo a release of a deactivated member (RN-013)', async () => {
    const ana = AssigneeId.create(await memberId());
    const task = Task.create({ id: TaskId.generate(), title: TaskTitle.create('Carrera') });
    task.assignTo(TeamMember.create({ id: ana, active: true }));
    task.changeStatus(TaskStatus.create('IN_PROGRESS'));
    await tasks.save(task);

    const statusChange = (await tasks.findById(task.id))!;
    const release = (await tasks.findById(task.id))!;
    release.releaseAssignee();
    await tasks.save(release);
    statusChange.changeStatus(TaskStatus.create('IN_REVIEW'));

    await expect(tasks.save(statusChange)).rejects.toBeInstanceOf(TaskConcurrentModificationError);
    const [row] = await dataSource.query('SELECT status, assignee_id, version FROM tasks WHERE id = $1', [task.id.value]);
    expect(row).toEqual({ status: 'TODO', assignee_id: null, version: 2 });
  });

  it('a user cannot be deactivated twice through stale copies', async () => {
    const id = UserId.create(await memberId());
    const first = (await users.findById(id))!;
    const second = (await users.findById(id))!;
    first.deactivate();
    await users.save(first);
    second.deactivate();

    await expect(users.save(second)).rejects.toBeInstanceOf(UserConcurrentModificationError);
  });

  it('sequential HTTP operations keep working and bump the version', async () => {
    const ana = await memberId();
    const http = () => request(app.getHttpServer());
    const { body } = await http().post('/tasks').send({ title: 'Secuencial' }).expect(201);

    await http().patch(`/tasks/${body.id}/assignee`).send({ assigneeId: ana }).expect(204);
    await http().patch(`/tasks/${body.id}/status`).send({ status: 'IN_PROGRESS' }).expect(204);

    const [row] = await dataSource.query('SELECT version FROM tasks WHERE id = $1', [body.id]);
    expect(row.version).toBe(3);
    expect((await http().get(`/tasks/${body.id}`).expect(200)).body).not.toHaveProperty('version');
  });
});
