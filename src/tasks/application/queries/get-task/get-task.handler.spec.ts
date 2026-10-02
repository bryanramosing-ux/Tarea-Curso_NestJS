import { Task } from '../../../domain/entities/task';
import { TaskNotFoundError } from '../../../domain/errors/task.errors';
import { TaskId } from '../../../domain/value-objects/task-id';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { InMemoryTaskRepository } from '../../../infrastructure/persistence/in-memory/in-memory-task.repository';
import { GetTaskHandler } from './get-task.handler';
import { GetTaskQuery } from './get-task.query';

describe('GetTaskHandler', () => {
  it('returns the task view', async () => {
    const tasks = new InMemoryTaskRepository();
    const task = Task.create(
      { id: TaskId.generate(), title: TaskTitle.create('Preparar demo') },
      new Date('2026-02-01T09:00:00.000Z'),
    );
    await tasks.save(task);

    await expect(new GetTaskHandler(tasks).execute(new GetTaskQuery(task.id.value))).resolves.toEqual({
      id: task.id.value,
      title: 'Preparar demo',
      description: '',
      status: 'TODO',
      priority: 'MEDIUM',
      assigneeId: null,
      createdAt: '2026-02-01T09:00:00.000Z',
      updatedAt: '2026-02-01T09:00:00.000Z',
    });
  });

  it('throws NOT_FOUND for an unknown task', async () => {
    await expect(
      new GetTaskHandler(new InMemoryTaskRepository()).execute(new GetTaskQuery(TaskId.generate().value)),
    ).rejects.toBeInstanceOf(TaskNotFoundError);
  });
});
