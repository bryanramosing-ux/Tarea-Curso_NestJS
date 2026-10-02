import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { Task } from '../../../domain/entities/task';
import {
  InvalidStatusTransitionError,
  InvalidTaskStatusError,
  TaskNotFoundError,
  TaskRequiresAssigneeError,
} from '../../../domain/errors/task.errors';
import { TaskStatusChanged } from '../../../domain/events/task-status-changed.event';
import { AssigneeId } from '../../../domain/value-objects/assignee-id';
import { TaskId } from '../../../domain/value-objects/task-id';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { TeamMember } from '../../../domain/value-objects/team-member';
import { InMemoryTaskRepository } from '../../../infrastructure/persistence/in-memory/in-memory-task.repository';
import { ChangeTaskStatusCommand } from './change-task-status.command';
import { ChangeTaskStatusHandler } from './change-task-status.handler';

const ANA = AssigneeId.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');

describe('ChangeTaskStatusHandler', () => {
  let tasks: InMemoryTaskRepository;
  let events: InMemoryDomainEventPublisher;
  let handler: ChangeTaskStatusHandler;

  beforeEach(() => {
    tasks = new InMemoryTaskRepository();
    events = new InMemoryDomainEventPublisher();
    handler = new ChangeTaskStatusHandler(tasks, events);
  });

  async function storedTask(assigned: boolean): Promise<Task> {
    const task = Task.create({ id: TaskId.generate(), title: TaskTitle.create('Preparar demo') });
    if (assigned) {
      task.assignTo(TeamMember.create({ id: ANA, active: true }));
    }
    task.pullDomainEvents();
    await tasks.save(task);
    return task;
  }

  it('moves an assigned task to IN_PROGRESS and publishes TaskStatusChanged', async () => {
    const task = await storedTask(true);

    await handler.execute(new ChangeTaskStatusCommand(task.id.value, 'in_progress'));

    expect((await tasks.findById(task.id))?.status.value).toBe('IN_PROGRESS');
    expect(events.published).toEqual([expect.any(TaskStatusChanged)]);
    expect(events.published[0]).toMatchObject({ from: 'TODO', to: 'IN_PROGRESS' });
  });

  it('delegates the transition rules to the domain (RN-009)', async () => {
    const task = await storedTask(true);
    await expect(handler.execute(new ChangeTaskStatusCommand(task.id.value, 'DONE'))).rejects.toBeInstanceOf(
      InvalidStatusTransitionError,
    );
    expect((await tasks.findById(task.id))?.status.value).toBe('TODO');
    expect(events.published).toHaveLength(0);
  });

  it('requires an assignee outside TODO (RN-010)', async () => {
    const task = await storedTask(false);
    await expect(handler.execute(new ChangeTaskStatusCommand(task.id.value, 'IN_PROGRESS'))).rejects.toBeInstanceOf(
      TaskRequiresAssigneeError,
    );
  });

  it('rejects unknown statuses and unknown tasks', async () => {
    const task = await storedTask(true);
    await expect(handler.execute(new ChangeTaskStatusCommand(task.id.value, 'BLOCKED'))).rejects.toBeInstanceOf(
      InvalidTaskStatusError,
    );
    await expect(
      handler.execute(new ChangeTaskStatusCommand(TaskId.generate().value, 'IN_PROGRESS')),
    ).rejects.toBeInstanceOf(TaskNotFoundError);
  });
});
