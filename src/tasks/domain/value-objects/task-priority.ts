import { InvalidTaskPriorityError } from '../errors/task.errors';

export const TaskPriorityValue = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

export type TaskPriorityValue = (typeof TaskPriorityValue)[keyof typeof TaskPriorityValue];

const VALID_VALUES: readonly string[] = Object.values(TaskPriorityValue);

/** RN-014: prioridad LOW | MEDIUM | HIGH (MEDIUM por defecto, RN-008). */
export class TaskPriority {
  private constructor(public readonly value: TaskPriorityValue) {}

  static create(value: string): TaskPriority {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!VALID_VALUES.includes(normalized)) {
      throw new InvalidTaskPriorityError(String(value));
    }
    return new TaskPriority(normalized as TaskPriorityValue);
  }

  static default(): TaskPriority {
    return new TaskPriority(TaskPriorityValue.MEDIUM);
  }

  equals(other: TaskPriority): boolean {
    return other instanceof TaskPriority && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
