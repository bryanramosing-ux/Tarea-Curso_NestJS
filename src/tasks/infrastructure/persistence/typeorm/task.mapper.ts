import { Task } from '../../../domain/entities/task';
import { TaskOrmEntity } from './task.orm-entity';

/** Traduce entre el agregado Task y su modelo de persistencia. */
export class TaskMapper {
  static toDomain(row: TaskOrmEntity): Task {
    return Task.fromPrimitives({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assigneeId: row.assigneeId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static toPersistence(task: Task): TaskOrmEntity {
    const primitives = task.toPrimitives();
    const row = new TaskOrmEntity();
    row.id = primitives.id;
    row.title = primitives.title;
    row.description = primitives.description;
    row.status = primitives.status;
    row.priority = primitives.priority;
    row.assigneeId = primitives.assigneeId;
    row.createdAt = primitives.createdAt;
    row.updatedAt = primitives.updatedAt;
    return row;
  }
}
