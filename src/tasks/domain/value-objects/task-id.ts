import { generateUuid, isValidUuid } from '../../../shared/domain/uuid';
import { InvalidTaskIdError } from '../errors/task.errors';

export class TaskId {
  private constructor(public readonly value: string) {}

  static create(value: string): TaskId {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!isValidUuid(normalized)) {
      throw new InvalidTaskIdError(String(value));
    }
    return new TaskId(normalized);
  }

  static generate(): TaskId {
    return new TaskId(generateUuid());
  }

  equals(other: TaskId): boolean {
    return other instanceof TaskId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
