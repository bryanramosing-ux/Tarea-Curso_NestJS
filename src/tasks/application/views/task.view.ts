import { Task } from '../../domain/entities/task';

/** Modelo de lectura público del contexto Tasks. */
export interface TaskView {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toTaskView(task: Task): TaskView {
  return {
    id: task.id.value,
    title: task.title.value,
    description: task.description.value,
    status: task.status.value,
    priority: task.priority.value,
    assigneeId: task.assigneeId?.value ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
