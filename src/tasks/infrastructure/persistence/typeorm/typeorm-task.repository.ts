import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Not, QueryFailedError, Repository } from 'typeorm';
import { Task } from '../../../domain/entities/task';
import { AssigneeNotFoundError, TaskConcurrentModificationError } from '../../../domain/errors/task.errors';
import { TaskRepository, TaskSearchCriteria } from '../../../domain/ports/task.repository';
import { AssigneeId } from '../../../domain/value-objects/assignee-id';
import { TaskId } from '../../../domain/value-objects/task-id';
import { TaskStatusValue } from '../../../domain/value-objects/task-status';
import { TaskMapper } from './task.mapper';
import { TaskOrmEntity } from './task.orm-entity';

const FOREIGN_KEY_VIOLATION = '23503';
export const TASKS_ASSIGNEE_FOREIGN_KEY = 'fk_tasks_assignee';

/**
 * Adaptador real (PostgreSQL + TypeORM) del puerto TaskRepository.
 * Inserta los agregados nuevos (version 0) y actualiza los existentes con
 * bloqueo optimista: si la versión almacenada ya no es la leída, otra
 * operación cambió la tarea en paralelo y se rechaza el guardado en lugar
 * de sobrescribirla (evita "actualizaciones perdidas").
 */
@Injectable()
export class TypeOrmTaskRepository implements TaskRepository {
  constructor(
    @InjectRepository(TaskOrmEntity)
    private readonly repository: Repository<TaskOrmEntity>,
  ) {}

  async save(task: Task): Promise<void> {
    const row = TaskMapper.toPersistence(task);
    try {
      if (task.version === 0) {
        await this.repository.insert({ ...row, version: 1 });
      } else {
        const { id, version, ...changes } = row;
        const result = await this.repository.update({ id, version }, { ...changes, version: version + 1 });
        if (!result.affected) {
          throw new TaskConcurrentModificationError(id);
        }
      }
    } catch (error) {
      if (this.isAssigneeForeignKeyViolation(error) && task.assigneeId) {
        throw new AssigneeNotFoundError(task.assigneeId.value);
      }
      throw error;
    }
    task.markAsPersisted();
  }

  async findById(id: TaskId): Promise<Task | null> {
    const row = await this.repository.findOneBy({ id: id.value });
    return row ? TaskMapper.toDomain(row) : null;
  }

  async search(criteria: TaskSearchCriteria): Promise<Task[]> {
    const where: FindOptionsWhere<TaskOrmEntity> = {};
    if (criteria.status) {
      where.status = criteria.status.value;
    }
    if (criteria.assigneeId) {
      where.assigneeId = criteria.assigneeId.value;
    }
    const rows = await this.repository.find({ where, order: { createdAt: 'ASC', id: 'ASC' } });
    return rows.map((row) => TaskMapper.toDomain(row));
  }

  async findUnfinishedByAssignee(assigneeId: AssigneeId): Promise<Task[]> {
    const rows = await this.repository.find({
      where: { assigneeId: assigneeId.value, status: Not(TaskStatusValue.DONE) },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map((row) => TaskMapper.toDomain(row));
  }

  private isAssigneeForeignKeyViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = error.driverError as { code?: string; constraint?: string };
    return driverError.code === FOREIGN_KEY_VIOLATION && driverError.constraint === TASKS_ASSIGNEE_FOREIGN_KEY;
  }
}
