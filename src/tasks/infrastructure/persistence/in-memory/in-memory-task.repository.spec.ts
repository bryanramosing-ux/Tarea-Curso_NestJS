import { Task } from '../../../domain/entities/task';
import { TaskConcurrentModificationError } from '../../../domain/errors/task.errors';
import { AssigneeId } from '../../../domain/value-objects/assignee-id';
import { TaskId } from '../../../domain/value-objects/task-id';
import { TaskStatus } from '../../../domain/value-objects/task-status';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { TeamMember } from '../../../domain/value-objects/team-member';
import { InMemoryTaskRepository } from './in-memory-task.repository';

const ANA = AssigneeId.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');

describe('InMemoryTaskRepository (contrato del puerto TaskRepository)', () => {
  it('returns null when the task does not exist', async () => {
    await expect(new InMemoryTaskRepository().findById(TaskId.generate())).resolves.toBeNull();
  });

  it('rejects a stale copy: a release and a status change cannot silently overwrite each other', async () => {
    const repository = new InMemoryTaskRepository();
    const task = Task.create({ id: TaskId.generate(), title: TaskTitle.create('Carrera') });
    task.assignTo(TeamMember.create({ id: ANA, active: true }));
    task.changeStatus(TaskStatus.create('IN_PROGRESS'));
    await repository.save(task);

    const statusChange = (await repository.findById(task.id))!;
    const release = (await repository.findById(task.id))!;
    release.releaseAssignee();
    await repository.save(release);
    statusChange.changeStatus(TaskStatus.create('IN_REVIEW'));

    await expect(repository.save(statusChange)).rejects.toBeInstanceOf(TaskConcurrentModificationError);
    expect((await repository.findById(task.id))?.toPrimitives()).toMatchObject({
      status: 'TODO',
      assigneeId: null,
      version: 2,
    });
  });
});
