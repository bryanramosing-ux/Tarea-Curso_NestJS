import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { Task } from '../../../domain/entities/task';
import { TaskConcurrentModificationError } from '../../../domain/errors/task.errors';
import { TaskUnassigned } from '../../../domain/events/task-unassigned.event';
import { AssigneeId } from '../../../domain/value-objects/assignee-id';
import { TaskId } from '../../../domain/value-objects/task-id';
import { TaskStatus } from '../../../domain/value-objects/task-status';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { TeamMember } from '../../../domain/value-objects/team-member';
import { InMemoryTaskRepository } from '../../../infrastructure/persistence/in-memory/in-memory-task.repository';
import { ReleaseMemberTasksCommand } from './release-member-tasks.command';
import { RELEASE_MAX_ATTEMPTS, ReleaseMemberTasksHandler } from './release-member-tasks.handler';

const ANA = AssigneeId.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');
const LUIS = AssigneeId.create('1b4e28ba-2fa1-41d2-883f-0016d3cca427');

async function storeTask(repository: InMemoryTaskRepository, assignee: AssigneeId, steps: string[]): Promise<Task> {
  const task = Task.create({ id: TaskId.generate(), title: TaskTitle.create(`Tarea ${steps.join('-') || 'todo'}`) });
  task.assignTo(TeamMember.create({ id: assignee, active: true }));
  steps.forEach((step) => task.changeStatus(TaskStatus.create(step)));
  task.pullDomainEvents();
  await repository.save(task);
  return task;
}

describe('ReleaseMemberTasksHandler (RN-013)', () => {
  it('releases only the unfinished tasks of the member and publishes TaskUnassigned for each', async () => {
    const tasks = new InMemoryTaskRepository();
    const events = new InMemoryDomainEventPublisher();
    const todo = await storeTask(tasks, ANA, []);
    const inProgress = await storeTask(tasks, ANA, ['IN_PROGRESS']);
    const done = await storeTask(tasks, ANA, ['IN_PROGRESS', 'IN_REVIEW', 'DONE']);
    const othersTask = await storeTask(tasks, LUIS, ['IN_PROGRESS']);

    const result = await new ReleaseMemberTasksHandler(tasks, events).execute(new ReleaseMemberTasksCommand(ANA.value));

    expect(result.releasedTaskIds.sort()).toEqual([todo.id.value, inProgress.id.value].sort());
    for (const released of [todo, inProgress]) {
      const reloaded = await tasks.findById(released.id);
      expect(reloaded?.assigneeId).toBeNull();
      expect(reloaded?.status.value).toBe('TODO');
    }
    expect((await tasks.findById(done.id))?.isAssignedTo(ANA)).toBe(true);
    expect((await tasks.findById(othersTask.id))?.isAssignedTo(LUIS)).toBe(true);
    expect(events.published).toHaveLength(2);
    expect(events.published.every((event) => event instanceof TaskUnassigned)).toBe(true);
  });

  it('does nothing when the member has no open work', async () => {
    const events = new InMemoryDomainEventPublisher();
    const result = await new ReleaseMemberTasksHandler(new InMemoryTaskRepository(), events).execute(
      new ReleaseMemberTasksCommand(ANA.value),
    );
    expect(result.releasedTaskIds).toEqual([]);
    expect(events.published).toEqual([]);
  });
});

describe('ReleaseMemberTasksHandler under concurrent modifications', () => {
  /** Simula que otra petición modifica la tarea entre la lectura del handler y su guardado. */
  function concurrentlyModify(tasks: InMemoryTaskRepository, change: (task: Task) => void): void {
    const original = tasks.findUnfinishedByAssignee.bind(tasks);
    jest.spyOn(tasks, 'findUnfinishedByAssignee').mockImplementation(async (assigneeId) => {
      const staleCopies = await original(assigneeId);
      for (const stale of staleCopies) {
        const fresh = (await tasks.findById(stale.id))!;
        change(fresh);
        await tasks.save(fresh);
      }
      return staleCopies;
    });
  }

  it('reloads and retries, so the task never stays with a deactivated member', async () => {
    const tasks = new InMemoryTaskRepository();
    const events = new InMemoryDomainEventPublisher();
    const task = await storeTask(tasks, ANA, ['IN_PROGRESS']);
    concurrentlyModify(tasks, (fresh) => fresh.changeStatus(TaskStatus.create('IN_REVIEW')));

    const result = await new ReleaseMemberTasksHandler(tasks, events).execute(new ReleaseMemberTasksCommand(ANA.value));

    expect(result.releasedTaskIds).toEqual([task.id.value]);
    expect((await tasks.findById(task.id))?.toPrimitives()).toMatchObject({ status: 'TODO', assigneeId: null });
    expect(events.published).toEqual([expect.objectContaining({ previousStatus: 'IN_REVIEW' })]);
  });

  it('skips a task that, after reloading, is no longer assigned to the member', async () => {
    const tasks = new InMemoryTaskRepository();
    const events = new InMemoryDomainEventPublisher();
    const task = await storeTask(tasks, ANA, ['IN_PROGRESS']);
    concurrentlyModify(tasks, (fresh) => fresh.assignTo(TeamMember.create({ id: LUIS, active: true })));

    const result = await new ReleaseMemberTasksHandler(tasks, events).execute(new ReleaseMemberTasksCommand(ANA.value));

    expect(result.releasedTaskIds).toEqual([]);
    expect((await tasks.findById(task.id))?.isAssignedTo(LUIS)).toBe(true);
    expect(events.published).toEqual([]);
  });

  it('gives up after RELEASE_MAX_ATTEMPTS conflicts and reports the failure', async () => {
    const tasks = new InMemoryTaskRepository();
    await storeTask(tasks, ANA, ['IN_PROGRESS']);
    const save = jest.spyOn(tasks, 'save').mockRejectedValue(new TaskConcurrentModificationError('x'));

    await expect(
      new ReleaseMemberTasksHandler(tasks, new InMemoryDomainEventPublisher()).execute(
        new ReleaseMemberTasksCommand(ANA.value),
      ),
    ).rejects.toBeInstanceOf(TaskConcurrentModificationError);
    expect(save).toHaveBeenCalledTimes(RELEASE_MAX_ATTEMPTS);
  });
});
