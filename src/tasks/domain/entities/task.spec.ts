import { DomainErrorKind } from '../../../shared/domain/domain-exception';
import {
  AssigneeInactiveError,
  InvalidStatusTransitionError,
  InvalidTaskTitleError,
  TaskAlreadyDoneError,
  TaskInvariantViolationError,
  TaskRequiresAssigneeError,
} from '../errors/task.errors';
import { TaskAssigned } from '../events/task-assigned.event';
import { TaskCreated } from '../events/task-created.event';
import { TaskStatusChanged } from '../events/task-status-changed.event';
import { TaskUnassigned } from '../events/task-unassigned.event';
import { AssigneeId } from '../value-objects/assignee-id';
import { TaskDescription } from '../value-objects/task-description';
import { TaskId } from '../value-objects/task-id';
import { TaskPriority } from '../value-objects/task-priority';
import { TaskStatus } from '../value-objects/task-status';
import { TaskTitle } from '../value-objects/task-title';
import { TeamMember } from '../value-objects/team-member';
import { Task, TaskPrimitives } from './task';

const T0 = new Date('2026-02-01T09:00:00.000Z');
const T1 = new Date('2026-02-01T10:00:00.000Z');
const ANA = AssigneeId.create('7c9e6679-7425-40de-944b-e07fc1f90ae7');
const LUIS = AssigneeId.create('1b4e28ba-2fa1-41d2-883f-0016d3cca427');
const active = (id: AssigneeId) => TeamMember.create({ id, active: true });
const status = (value: string) => TaskStatus.create(value);

function newTask(): Task {
  const task = Task.create({ id: TaskId.generate(), title: TaskTitle.create('Preparar demo') }, T0);
  task.pullDomainEvents();
  return task;
}

function taskIn(value: string): Task {
  const task = newTask();
  task.assignTo(active(ANA), T1);
  const path: Record<string, string[]> = {
    TODO: [],
    IN_PROGRESS: ['IN_PROGRESS'],
    IN_REVIEW: ['IN_PROGRESS', 'IN_REVIEW'],
    DONE: ['IN_PROGRESS', 'IN_REVIEW', 'DONE'],
  };
  path[value].forEach((step) => task.changeStatus(status(step), T1));
  task.pullDomainEvents();
  return task;
}

describe('Task aggregate', () => {
  describe('create (RN-008)', () => {
    it('starts in TODO, unassigned, MEDIUM priority and records TaskCreated', () => {
      const task = Task.create({ id: TaskId.generate(), title: TaskTitle.create('Preparar demo') }, T0);

      expect(task.status.value).toBe('TODO');
      expect(task.assigneeId).toBeNull();
      expect(task.priority.value).toBe('MEDIUM');
      expect(task.description.isEmpty()).toBe(true);
      expect(task.pullDomainEvents()).toEqual([new TaskCreated(task.id.value, 'Preparar demo', 'MEDIUM', T0)]);
    });

    it('keeps explicit description and priority', () => {
      const task = Task.create({
        id: TaskId.generate(),
        title: TaskTitle.create('Preparar demo'),
        description: TaskDescription.create('Para inversores'),
        priority: TaskPriority.create('HIGH'),
      });
      expect(task.description.value).toBe('Para inversores');
      expect(task.priority.value).toBe('HIGH');
    });
  });

  describe('assignTo (RN-011, RN-012)', () => {
    it('assigns an active member and records TaskAssigned', () => {
      const task = newTask();
      task.assignTo(active(ANA), T1);

      expect(task.isAssignedTo(ANA)).toBe(true);
      expect(task.updatedAt).toEqual(T1);
      expect(task.pullDomainEvents()).toEqual([new TaskAssigned(task.id.value, ANA.value, null, T1)]);
    });

    it('reassigns and remembers the previous assignee', () => {
      const task = newTask();
      task.assignTo(active(ANA), T1);
      task.pullDomainEvents();

      task.assignTo(active(LUIS), T1);

      expect(task.isAssignedTo(LUIS)).toBe(true);
      expect(task.pullDomainEvents()).toEqual([new TaskAssigned(task.id.value, LUIS.value, ANA.value, T1)]);
    });

    it('is idempotent when assigning the same member', () => {
      const task = newTask();
      task.assignTo(active(ANA), T1);
      task.pullDomainEvents();

      task.assignTo(active(ANA));

      expect(task.pullDomainEvents()).toEqual([]);
      expect(task.updatedAt).toEqual(T1);
    });

    it('refuses an inactive member (CONFLICT)', () => {
      const task = newTask();
      expect(() => task.assignTo(TeamMember.create({ id: ANA, active: false }))).toThrow(
        expect.objectContaining({ code: 'TASK_ASSIGNEE_INACTIVE', kind: DomainErrorKind.CONFLICT }),
      );
      expect(() => task.assignTo(TeamMember.create({ id: ANA, active: false }))).toThrow(AssigneeInactiveError);
      expect(task.assigneeId).toBeNull();
    });

    it('refuses to reassign a DONE task', () => {
      expect(() => taskIn('DONE').assignTo(active(LUIS))).toThrow(TaskAlreadyDoneError);
    });
  });

  describe('changeStatus (RN-009, RN-010, RN-012)', () => {
    it('follows the Kanban flow up to DONE recording each change', () => {
      const task = newTask();
      task.assignTo(active(ANA), T1);
      task.pullDomainEvents();

      task.changeStatus(status('IN_PROGRESS'), T1);
      task.changeStatus(status('IN_REVIEW'), T1);
      task.changeStatus(status('DONE'), T1);

      expect(task.status.value).toBe('DONE');
      expect(task.pullDomainEvents()).toEqual([
        new TaskStatusChanged(task.id.value, 'TODO', 'IN_PROGRESS', T1),
        new TaskStatusChanged(task.id.value, 'IN_PROGRESS', 'IN_REVIEW', T1),
        new TaskStatusChanged(task.id.value, 'IN_REVIEW', 'DONE', T1),
      ]);
    });

    it('cannot leave TODO without an assignee', () => {
      const task = newTask();
      expect(() => task.changeStatus(status('IN_PROGRESS'))).toThrow(TaskRequiresAssigneeError);
      expect(task.status.value).toBe('TODO');
      expect(task.pullDomainEvents()).toEqual([]);
    });

    it('rejects skipping columns', () => {
      const task = taskIn('IN_PROGRESS');
      expect(() => task.changeStatus(status('DONE'))).toThrow(InvalidStatusTransitionError);
      expect(task.status.value).toBe('IN_PROGRESS');
    });

    it('rejects moving to the current status', () => {
      expect(() => taskIn('IN_REVIEW').changeStatus(status('IN_REVIEW'))).toThrow(
        expect.objectContaining({ code: 'TASK_INVALID_STATUS_TRANSITION', kind: DomainErrorKind.CONFLICT }),
      );
    });

    it('allows sending work back from review', () => {
      const task = taskIn('IN_REVIEW');
      task.changeStatus(status('IN_PROGRESS'));
      expect(task.status.value).toBe('IN_PROGRESS');
    });

    it('a DONE task never changes again', () => {
      expect(() => taskIn('DONE').changeStatus(status('IN_PROGRESS'))).toThrow(TaskAlreadyDoneError);
    });
  });

  describe('releaseAssignee (RN-013)', () => {
    it.each(['TODO', 'IN_PROGRESS', 'IN_REVIEW'])(
      'leaves a %s task unassigned and back in TODO',
      (initial) => {
        const task = taskIn(initial);

        task.releaseAssignee(T1);

        expect(task.assigneeId).toBeNull();
        expect(task.status.value).toBe('TODO');
        expect(task.pullDomainEvents()).toEqual([new TaskUnassigned(task.id.value, ANA.value, initial, T1)]);
      },
    );

    it('does nothing for an unassigned task', () => {
      const task = newTask();
      task.releaseAssignee();
      expect(task.pullDomainEvents()).toEqual([]);
    });

    it('refuses to touch a DONE task', () => {
      expect(() => taskIn('DONE').releaseAssignee()).toThrow(TaskAlreadyDoneError);
    });
  });

  describe('toPrimitives / fromPrimitives', () => {
    it('round-trips without emitting events', () => {
      const original = taskIn('IN_REVIEW');
      const restored = Task.fromPrimitives(original.toPrimitives());
      expect(restored.toPrimitives()).toEqual(original.toPrimitives());
      expect(restored.pullDomainEvents()).toEqual([]);
    });

    it('re-validates value objects and invariants when reconstructing', () => {
      const valid = taskIn('IN_PROGRESS').toPrimitives();
      const corrupt = (patch: Partial<TaskPrimitives>): TaskPrimitives => ({ ...valid, ...patch });

      expect(() => Task.fromPrimitives(corrupt({ title: 'x' }))).toThrow(InvalidTaskTitleError);
      expect(() => Task.fromPrimitives(corrupt({ assigneeId: null }))).toThrow(TaskInvariantViolationError);
      expect(() => Task.fromPrimitives(corrupt({ updatedAt: new Date('2000-01-01') }))).toThrow(
        TaskInvariantViolationError,
      );
    });
  });
});
