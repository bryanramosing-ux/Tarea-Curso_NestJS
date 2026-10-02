import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TaskNotFoundError } from '../../../domain/errors/task.errors';
import { TASK_REPOSITORY, TaskRepository } from '../../../domain/ports/task.repository';
import { TaskId } from '../../../domain/value-objects/task-id';
import { TaskView, toTaskView } from '../../views/task.view';
import { GetTaskQuery } from './get-task.query';

@QueryHandler(GetTaskQuery)
export class GetTaskHandler implements IQueryHandler<GetTaskQuery> {
  constructor(@Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository) {}

  async execute(query: GetTaskQuery): Promise<TaskView> {
    const id = TaskId.create(query.taskId);
    const task = await this.tasks.findById(id);
    if (!task) {
      throw new TaskNotFoundError(id.value);
    }
    return toTaskView(task);
  }
}
