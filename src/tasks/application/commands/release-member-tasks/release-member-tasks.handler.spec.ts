import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { Task } from '../../../domain/entities/task';
import { TaskUnassigned } from '../../../domain/events/task-unassigned.event';
import { AssigneeId } from '../../../domain/value-objects/assignee-id';
import { TaskId } from '../../../domain/value-objects/task-id';
import { TaskStatus } from '../../../domain/value-objects/task-status';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { TeamMember } from '../../../domain/value-objects/team-member';
import { InMemoryTaskRepository } from '../../../infrastructure/persistence/in-memory/in-memory-task.repository';
import { ReleaseMemberTasksCommand } from './release-member-tasks.command';
import { ReleaseMemberTasksHandler } from './release-member-tasks.handler';

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
