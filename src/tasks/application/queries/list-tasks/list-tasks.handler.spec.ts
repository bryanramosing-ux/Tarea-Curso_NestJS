import { Task } from '../../../domain/entities/task';
import { InvalidTaskStatusError } from '../../../domain/errors/task.errors';
import { AssigneeId } from '../../../domain/value-objects/assignee-id';
import { TaskId } from '../../../domain/value-objects/task-id';
import { TaskStatus } from '../../../domain/value-objects/task-status';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { TeamMember } from '../../../domain/value-objects/team-member';
import { InMemoryTaskRepository } from '../../../infrastructure/persistence/in-memory/in-memory-task.repository';
import { ListTasksHandler } from './list-tasks.handler';
import { ListTasksQuery } from './list-tasks.query';

const ANA = AssigneeId.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');

describe('ListTasksHandler', () => {
  let tasks: InMemoryTaskRepository;
  let handler: ListTasksHandler;

  beforeEach(async () => {
    tasks = new InMemoryTaskRepository();
    handler = new ListTasksHandler(tasks);

    const first = Task.create({ id: TaskId.generate(), title: TaskTitle.create('Primera') }, new Date('2026-02-01'));
    const second = Task.create({ id: TaskId.generate(), title: TaskTitle.create('Segunda') }, new Date('2026-02-02'));
    second.assignTo(TeamMember.create({ id: ANA, active: true }), new Date('2026-02-03'));
    second.changeStatus(TaskStatus.create('IN_PROGRESS'), new Date('2026-02-03'));
    await tasks.save(second);
    await tasks.save(first);
  });

  it('lists the whole board ordered by creation date', async () => {
    const views = await handler.execute(new ListTasksQuery());
    expect(views.map((view) => view.title)).toEqual(['Primera', 'Segunda']);
  });

  it('filters by status and by assignee', async () => {
    expect((await handler.execute(new ListTasksQuery('in_progress'))).map((view) => view.title)).toEqual(['Segunda']);
    expect((await handler.execute(new ListTasksQuery(undefined, ANA.value))).map((view) => view.title)).toEqual([
      'Segunda',
    ]);
    expect(await handler.execute(new ListTasksQuery('DONE'))).toEqual([]);
  });

  it('rejects an unknown status filter', async () => {
    await expect(handler.execute(new ListTasksQuery('BLOCKED'))).rejects.toBeInstanceOf(InvalidTaskStatusError);
  });
});
