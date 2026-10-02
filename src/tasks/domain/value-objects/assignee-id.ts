import { isValidUuid } from '../../../shared/domain/uuid';
import { InvalidAssigneeIdError } from '../errors/task.errors';

/**
 * Identidad de un responsable DENTRO del contexto Tasks.
 * Es deliberadamente distinto de UserId (contexto Users): los contextos
 * no comparten value objects, solo el valor del identificador.
 */
export class AssigneeId {
  private constructor(public readonly value: string) {}

  static create(value: string): AssigneeId {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!isValidUuid(normalized)) {
      throw new InvalidAssigneeIdError(String(value));
    }
    return new AssigneeId(normalized);
  }

  equals(other: AssigneeId): boolean {
    return other instanceof AssigneeId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
