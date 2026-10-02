import { Task, TaskPrimitives } from '../../../domain/entities/task';
import { TaskConcurrentModificationError } from '../../../domain/errors/task.errors';
import { TaskRepository, TaskSearchCriteria } from '../../../domain/ports/task.repository';
import { AssigneeId } from '../../../domain/value-objects/assignee-id';
import { TaskId } from '../../../domain/value-objects/task-id';
import { TaskStatusValue } from '../../../domain/value-objects/task-status';

/**
 * Adaptador en memoria del puerto TaskRepository (pruebas unitarias).
 * Guarda copias de las primitivas, reconstruye con fromPrimitives y emula el
 * bloqueo optimista por versión del adaptador real.
 */
export class InMemoryTaskRepository implements TaskRepository {
  private readonly rows = new Map<string, TaskPrimitives>();

  async save(task: Task): Promise<void> {
    const primitives = task.toPrimitives();
    const stored = this.rows.get(primitives.id);
    if ((stored?.version ?? 0) !== primitives.version) {
      throw new TaskConcurrentModificationError(primitives.id);
    }
    this.rows.set(primitives.id, { ...primitives, version: primitives.version + 1 });
    task.markAsPersisted();
  }

  async findById(id: TaskId): Promise<Task | null> {
    const row = this.rows.get(id.value);
    return row ? Task.fromPrimitives({ ...row }) : null;
  }

  async search(criteria: TaskSearchCriteria): Promise<Task[]> {
    return this.sorted()
      .filter((row) => !criteria.status || row.status === criteria.status.value)
      .filter((row) => !criteria.assigneeId || row.assigneeId === criteria.assigneeId.value)
      .map((row) => Task.fromPrimitives({ ...row }));
  }

  async findUnfinishedByAssignee(assigneeId: AssigneeId): Promise<Task[]> {
    return this.sorted()
      .filter((row) => row.assigneeId === assigneeId.value && row.status !== TaskStatusValue.DONE)
      .map((row) => Task.fromPrimitives({ ...row }));
  }

  private sorted(): TaskPrimitives[] {
    return [...this.rows.values()].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
    );
  }
}
