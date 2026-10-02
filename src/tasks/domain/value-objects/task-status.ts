import { InvalidTaskStatusError } from '../errors/task.errors';

export const TaskStatusValue = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  DONE: 'DONE',
} as const;

export type TaskStatusValue = (typeof TaskStatusValue)[keyof typeof TaskStatusValue];

const VALID_VALUES: readonly string[] = Object.values(TaskStatusValue);

/**
 * RN-009: flujo del tablero Kanban.
 *   TODO        -> IN_PROGRESS
 *   IN_PROGRESS -> TODO | IN_REVIEW
 *   IN_REVIEW   -> IN_PROGRESS | DONE
 *   DONE        -> (estado final)
 */
const ALLOWED_TRANSITIONS: Record<TaskStatusValue, readonly TaskStatusValue[]> = {
  TODO: [TaskStatusValue.IN_PROGRESS],
  IN_PROGRESS: [TaskStatusValue.TODO, TaskStatusValue.IN_REVIEW],
  IN_REVIEW: [TaskStatusValue.IN_PROGRESS, TaskStatusValue.DONE],
  DONE: [],
};

export class TaskStatus {
  private constructor(public readonly value: TaskStatusValue) {}

  static create(value: string): TaskStatus {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!VALID_VALUES.includes(normalized)) {
      throw new InvalidTaskStatusError(String(value));
    }
    return new TaskStatus(normalized as TaskStatusValue);
  }

  static todo(): TaskStatus {
    return new TaskStatus(TaskStatusValue.TODO);
  }

  canTransitionTo(next: TaskStatus): boolean {
    return ALLOWED_TRANSITIONS[this.value].includes(next.value);
  }

  /** RN-010: fuera de TODO una tarea siempre tiene responsable. */
  requiresAssignee(): boolean {
    return this.value !== TaskStatusValue.TODO;
  }

  isTodo(): boolean {
    return this.value === TaskStatusValue.TODO;
  }

  isDone(): boolean {
    return this.value === TaskStatusValue.DONE;
  }

  equals(other: TaskStatus): boolean {
    return other instanceof TaskStatus && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
