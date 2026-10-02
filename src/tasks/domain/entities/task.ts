import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import {
  AssigneeInactiveError,
  InvalidStatusTransitionError,
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

export interface TaskPrimitives {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskProps {
  id: TaskId;
  title: TaskTitle;
  description?: TaskDescription;
  priority?: TaskPriority;
}

/**
 * Agregado Task (contexto Tasks): una tarjeta del tablero Kanban.
 * Protege sus invariantes:
 *  - RN-009 solo transiciones de estado permitidas;
 *  - RN-010 fuera de TODO siempre hay responsable;
 *  - RN-011 solo se asigna a miembros activos;
 *  - RN-012 una tarea DONE es inmutable.
 */
export class Task extends AggregateRoot {
  private constructor(
    private readonly _id: TaskId,
    private readonly _title: TaskTitle,
    private readonly _description: TaskDescription,
    private _status: TaskStatus,
    private readonly _priority: TaskPriority,
    private _assigneeId: AssigneeId | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
    this.assertInvariants();
  }

  /** RN-008: toda tarea nace en TODO, sin responsable y con prioridad MEDIUM por defecto. */
  static create(props: CreateTaskProps, now: Date = new Date()): Task {
    const task = new Task(
      props.id,
      props.title,
      props.description ?? TaskDescription.empty(),
      TaskStatus.todo(),
      props.priority ?? TaskPriority.default(),
      null,
      now,
      now,
    );
    task.record(new TaskCreated(task._id.value, task._title.value, task._priority.value, now));
    return task;
  }

  /** Reconstrucción desde persistencia: revalida value objects e invariantes. */
  static fromPrimitives(primitives: TaskPrimitives): Task {
    return new Task(
      TaskId.create(primitives.id),
      TaskTitle.create(primitives.title),
      TaskDescription.create(primitives.description),
      TaskStatus.create(primitives.status),
      TaskPriority.create(primitives.priority),
      primitives.assigneeId === null ? null : AssigneeId.create(primitives.assigneeId),
      primitives.createdAt,
      primitives.updatedAt,
    );
  }

  /** RN-011 + RN-012. Reasignar al mismo miembro no produce cambios ni eventos. */
  assignTo(member: TeamMember, now: Date = new Date()): void {
    this.assertNotDone();
    if (!member.isActive()) {
      throw new AssigneeInactiveError(member.id.value);
    }
    if (this._assigneeId?.equals(member.id)) {
      return;
    }
    const previous = this._assigneeId;
    this._assigneeId = member.id;
    this._updatedAt = now;
    this.record(new TaskAssigned(this._id.value, member.id.value, previous?.value ?? null, now));
  }

  /** RN-009 + RN-010 + RN-012. */
  changeStatus(next: TaskStatus, now: Date = new Date()): void {
    this.assertNotDone();
    if (!this._status.canTransitionTo(next)) {
      throw new InvalidStatusTransitionError(this._status.value, next.value);
    }
    if (next.requiresAssignee() && this._assigneeId === null) {
      throw new TaskRequiresAssigneeError(next.value);
    }
    const previous = this._status;
    this._status = next;
    this._updatedAt = now;
    this.record(new TaskStatusChanged(this._id.value, previous.value, next.value, now));
  }

  /**
   * RN-013: el responsable dejó de estar disponible. La tarea queda sin
   * responsable y, para respetar RN-010, vuelve a TODO.
   */
  releaseAssignee(now: Date = new Date()): void {
    this.assertNotDone();
    if (this._assigneeId === null) {
      return;
    }
    const previousAssignee = this._assigneeId;
    const previousStatus = this._status;
    this._assigneeId = null;
    this._status = TaskStatus.todo();
    this._updatedAt = now;
    this.record(new TaskUnassigned(this._id.value, previousAssignee.value, previousStatus.value, now));
  }

  isAssignedTo(assigneeId: AssigneeId): boolean {
    return this._assigneeId !== null && this._assigneeId.equals(assigneeId);
  }

  get id(): TaskId {
    return this._id;
  }

  get title(): TaskTitle {
    return this._title;
  }

  get description(): TaskDescription {
    return this._description;
  }

  get status(): TaskStatus {
    return this._status;
  }

  get priority(): TaskPriority {
    return this._priority;
  }

  get assigneeId(): AssigneeId | null {
    return this._assigneeId;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  toPrimitives(): TaskPrimitives {
    return {
      id: this._id.value,
      title: this._title.value,
      description: this._description.value,
      status: this._status.value,
      priority: this._priority.value,
      assigneeId: this._assigneeId?.value ?? null,
      createdAt: new Date(this._createdAt),
      updatedAt: new Date(this._updatedAt),
    };
  }

  private assertNotDone(): void {
    if (this._status.isDone()) {
      throw new TaskAlreadyDoneError(this._id.value);
    }
  }

  private assertInvariants(): void {
    if (this._status.requiresAssignee() && this._assigneeId === null) {
      throw new TaskInvariantViolationError(`status ${this._status.value} requires an assignee`);
    }
    const created = this._createdAt;
    const updated = this._updatedAt;
    if (
      !(created instanceof Date) ||
      !(updated instanceof Date) ||
      Number.isNaN(created.getTime()) ||
      Number.isNaN(updated.getTime()) ||
      updated.getTime() < created.getTime()
    ) {
      throw new TaskInvariantViolationError('timestamps are invalid');
    }
  }
}
