import { InvalidTaskDescriptionError } from '../errors/task.errors';

const MAX_LENGTH = 2000;

/** RN-007: descripción opcional (vacía por defecto) de hasta 2000 caracteres. */
export class TaskDescription {
  private constructor(public readonly value: string) {}

  static create(value: string | null | undefined): TaskDescription {
    if (value === null || value === undefined) {
      return TaskDescription.empty();
    }
    if (typeof value !== 'string') {
      throw new InvalidTaskDescriptionError();
    }
    const normalized = value.trim();
    if (normalized.length > MAX_LENGTH) {
      throw new InvalidTaskDescriptionError();
    }
    return new TaskDescription(normalized);
  }

  static empty(): TaskDescription {
    return new TaskDescription('');
  }

  isEmpty(): boolean {
    return this.value.length === 0;
  }

  equals(other: TaskDescription): boolean {
    return other instanceof TaskDescription && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
