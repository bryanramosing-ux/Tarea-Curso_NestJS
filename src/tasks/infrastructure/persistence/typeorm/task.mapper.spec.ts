import { Task } from '../../../domain/entities/task';
import { TaskInvariantViolationError } from '../../../domain/errors/task.errors';
import { AssigneeId } from '../../../domain/value-objects/assignee-id';
import { TaskId } from '../../../domain/value-objects/task-id';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { TeamMember } from '../../../domain/value-objects/team-member';
import { TaskStatus } from '../../../domain/value-objects/task-status';
import { TaskMapper } from './task.mapper';
import { TaskOrmEntity } from './task.orm-entity';

describe('TaskMapper', () => {
  const task = Task.create({ id: TaskId.generate(), title: TaskTitle.create('Preparar demo') });
  task.assignTo(TeamMember.create({ id: AssigneeId.create('7c9e6679-7425-40de-944b-e07fc1f90ae7'), active: true }));
  task.changeStatus(TaskStatus.create('IN_PROGRESS'));

  it('maps to a separate ORM class and back without losing data', () => {
    const row = TaskMapper.toPersistence(task);
    row.version = 1; // las filas almacenadas siempre tienen versión >= 1
    expect(row).toBeInstanceOf(TaskOrmEntity);
    expect(TaskMapper.toDomain(row).toPrimitives()).toEqual({ ...task.toPrimitives(), version: 1 });
  });

  it('refuses rows that break the aggregate invariants', () => {
    const row = TaskMapper.toPersistence(task);
    row.version = 1; // las filas almacenadas siempre tienen versión >= 1
    row.assigneeId = null;
    expect(() => TaskMapper.toDomain(row)).toThrow(TaskInvariantViolationError);
  });
});
