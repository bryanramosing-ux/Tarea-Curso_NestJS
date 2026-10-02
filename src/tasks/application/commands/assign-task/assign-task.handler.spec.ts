import { DomainErrorKind } from '../../../../shared/domain/domain-exception';
import { InMemoryDomainEventPublisher } from '../../../../shared/infrastructure/events/in-memory-domain-event-publisher';
import { Task } from '../../../domain/entities/task';
import {
  AssigneeInactiveError,
  AssigneeNotFoundError,
  InvalidAssigneeIdError,
  TaskNotFoundError,
} from '../../../domain/errors/task.errors';
import { TaskAssigned } from '../../../domain/events/task-assigned.event';
import { AssigneeId } from '../../../domain/value-objects/assignee-id';
import { TaskId } from '../../../domain/value-objects/task-id';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { TeamMember } from '../../../domain/value-objects/team-member';
import { InMemoryTeamMemberDirectory } from '../../../infrastructure/adapters/in-memory-team-member-directory';
import { InMemoryTaskRepository } from '../../../infrastructure/persistence/in-memory/in-memory-task.repository';
import { AssignTaskCommand } from './assign-task.command';
import { AssignTaskHandler } from './assign-task.handler';

const ANA = AssigneeId.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');
const GHOST = AssigneeId.create('1b4e28ba-2fa1-41d2-883f-0016d3cca427');
const FORMER = AssigneeId.create('6fa459ea-ee8a-4ca4-894e-db77e160355e');

describe('AssignTaskHandler', () => {
  let tasks: InMemoryTaskRepository;
  let members: InMemoryTeamMemberDirectory;
  let events: InMemoryDomainEventPublisher;
  let handler: AssignTaskHandler;
  let task: Task;

  beforeEach(async () => {
    tasks = new InMemoryTaskRepository();
    members = new InMemoryTeamMemberDirectory();
    events = new InMemoryDomainEventPublisher();
    handler = new AssignTaskHandler(tasks, members, events);

    members.add(TeamMember.create({ id: ANA, active: true }));
    members.add(TeamMember.create({ id: FORMER, active: false }));
    task = Task.create({ id: TaskId.generate(), title: TaskTitle.create('Preparar demo') });
    task.pullDomainEvents();
    await tasks.save(task);
  });

  it('assigns the task to an active member, persists and publishes TaskAssigned', async () => {
    await handler.execute(new AssignTaskCommand(task.id.value, ANA.value));

    expect((await tasks.findById(task.id))?.isAssignedTo(ANA)).toBe(true);
    expect(events.published).toEqual([expect.any(TaskAssigned)]);
    expect(events.published[0]).toMatchObject({ taskId: task.id.value, assigneeId: ANA.value });
  });

  it('fails with TASK_NOT_FOUND for an unknown task', async () => {
    await expect(handler.execute(new AssignTaskCommand(TaskId.generate().value, ANA.value))).rejects.toBeInstanceOf(
      TaskNotFoundError,
    );
  });

  it('fails with TASK_ASSIGNEE_NOT_FOUND when the member does not exist (RN-011)', async () => {
    const attempt = handler.execute(new AssignTaskCommand(task.id.value, GHOST.value));
    await expect(attempt).rejects.toBeInstanceOf(AssigneeNotFoundError);
    await expect(attempt).rejects.toMatchObject({ kind: DomainErrorKind.NOT_FOUND });
  });

  it('fails with CONFLICT when the member is inactive and keeps the task untouched (RN-011)', async () => {
    await expect(handler.execute(new AssignTaskCommand(task.id.value, FORMER.value))).rejects.toBeInstanceOf(
      AssigneeInactiveError,
    );
    expect((await tasks.findById(task.id))?.assigneeId).toBeNull();
    expect(events.published).toHaveLength(0);
  });

  it('validates ids before touching the repository', async () => {
    const findById = jest.spyOn(tasks, 'findById');
    await expect(handler.execute(new AssignTaskCommand(task.id.value, 'nope'))).rejects.toBeInstanceOf(
      InvalidAssigneeIdError,
    );
    expect(findById).not.toHaveBeenCalled();
  });
});
