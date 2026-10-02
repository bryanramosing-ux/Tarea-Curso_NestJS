import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { InvalidTaskPriorityError, InvalidTaskTitleError } from '../../../domain/errors/task.errors';
import { TaskCreated } from '../../../domain/events/task-created.event';
import { TaskId } from '../../../domain/value-objects/task-id';
import { InMemoryTaskRepository } from '../../../infrastructure/persistence/in-memory/in-memory-task.repository';
import { CreateTaskCommand } from './create-task.command';
import { CreateTaskHandler } from './create-task.handler';

describe('CreateTaskHandler (sin Nest, sin base de datos)', () => {
  let tasks: InMemoryTaskRepository;
  let events: InMemoryDomainEventPublisher;
  let handler: CreateTaskHandler;

  beforeEach(() => {
    tasks = new InMemoryTaskRepository();
    events = new InMemoryDomainEventPublisher();
    handler = new CreateTaskHandler(tasks, events);
  });

  it('creates a TODO task with defaults and returns its id', async () => {
    const { id } = await handler.execute(new CreateTaskCommand('  Preparar   demo '));

    const task = await tasks.findById(TaskId.create(id));
    expect(task?.toPrimitives()).toMatchObject({
      title: 'Preparar demo',
      description: '',
      status: 'TODO',
      priority: 'MEDIUM',
      assigneeId: null,
    });
  });

  it('publishes TaskCreated after persisting', async () => {
    const order: string[] = [];
    const save = tasks.save.bind(tasks);
    jest.spyOn(tasks, 'save').mockImplementation(async (task) => {
      order.push('save');
      await save(task);
    });
    jest.spyOn(events, 'publishAll').mockImplementation(async (published) => {
      order.push(`publish:${published.map((event) => event.eventName).join(',')}`);
    });

    await handler.execute(new CreateTaskCommand('Preparar demo', 'detalle', 'high'));

    expect(order).toEqual(['save', 'publish:tasks.task_created']);
  });

  it('emits TaskCreated with the normalized data', async () => {
    const { id } = await handler.execute(new CreateTaskCommand('Preparar demo', undefined, 'low'));
    expect(events.published).toEqual([expect.any(TaskCreated)]);
    expect(events.published[0]).toMatchObject({ taskId: id, title: 'Preparar demo', priority: 'LOW' });
  });

  it('rejects invalid input through the value objects and persists nothing', async () => {
    await expect(handler.execute(new CreateTaskCommand('ab'))).rejects.toBeInstanceOf(InvalidTaskTitleError);
    await expect(handler.execute(new CreateTaskCommand('Preparar demo', '', 'URGENT'))).rejects.toBeInstanceOf(
      InvalidTaskPriorityError,
    );
    expect(await tasks.search({})).toHaveLength(0);
    expect(events.published).toHaveLength(0);
  });
});
