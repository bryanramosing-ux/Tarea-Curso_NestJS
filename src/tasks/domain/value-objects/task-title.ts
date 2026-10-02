import { InvalidTaskTitleError } from '../errors/task.errors';

const MIN_LENGTH = 3;
const MAX_LENGTH = 120;

/** RN-006: título de 3 a 120 caracteres, con espacios normalizados. */
export class TaskTitle {
  private constructor(public readonly value: string) {}

  static create(value: string): TaskTitle {
    const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    if (normalized.length < MIN_LENGTH || normalized.length > MAX_LENGTH) {
      throw new InvalidTaskTitleError();
    }
    return new TaskTitle(normalized);
  }

  equals(other: TaskTitle): boolean {
    return other instanceof TaskTitle && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
