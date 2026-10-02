import { Task } from '../entities/task';
import { AssigneeId } from '../value-objects/assignee-id';
import { TaskId } from '../value-objects/task-id';
import { TaskStatus } from '../value-objects/task-status';

export const TASK_REPOSITORY = Symbol('TASK_REPOSITORY');

export interface TaskSearchCriteria {
  status?: TaskStatus;
  assigneeId?: AssigneeId;
}

/**
 * Puerto de persistencia del agregado Task.
 * `findById` devuelve `null` si no existe; los listados se ordenan por
 * fecha de creación ascendente (orden natural del tablero).
 */
export interface TaskRepository {
  save(task: Task): Promise<void>;
  findById(id: TaskId): Promise<Task | null>;
  search(criteria: TaskSearchCriteria): Promise<Task[]>;
  findUnfinishedByAssignee(assigneeId: AssigneeId): Promise<Task[]>;
}
