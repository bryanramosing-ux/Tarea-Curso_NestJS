import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TASK_REPOSITORY, TaskRepository } from '../../../domain/ports/task.repository';
import { AssigneeId } from '../../../domain/value-objects/assignee-id';
import { TaskStatus } from '../../../domain/value-objects/task-status';
import { TaskView, toTaskView } from '../../views/task.view';
import { ListTasksQuery } from './list-tasks.query';

@QueryHandler(ListTasksQuery)
export class ListTasksHandler implements IQueryHandler<ListTasksQuery> {
  constructor(@Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository) {}

  async execute(query: ListTasksQuery): Promise<TaskView[]> {
    const tasks = await this.tasks.search({
      status: query.status === undefined ? undefined : TaskStatus.create(query.status),
      assigneeId: query.assigneeId === undefined ? undefined : AssigneeId.create(query.assigneeId),
    });
    return tasks.map(toTaskView);
  }
}
