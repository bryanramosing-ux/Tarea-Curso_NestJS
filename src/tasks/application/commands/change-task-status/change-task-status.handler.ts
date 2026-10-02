import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { TaskNotFoundError } from '../../../domain/errors/task.errors';
import { TASK_REPOSITORY, TaskRepository } from '../../../domain/ports/task.repository';
import { TaskId } from '../../../domain/value-objects/task-id';
import { TaskStatus } from '../../../domain/value-objects/task-status';
import { ChangeTaskStatusCommand } from './change-task-status.command';

@CommandHandler(ChangeTaskStatusCommand)
export class ChangeTaskStatusHandler implements ICommandHandler<ChangeTaskStatusCommand> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: ChangeTaskStatusCommand): Promise<void> {
    const taskId = TaskId.create(command.taskId);
    const nextStatus = TaskStatus.create(command.status);

    const task = await this.tasks.findById(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId.value);
    }

    task.changeStatus(nextStatus);

    await this.tasks.save(task);
    await this.eventPublisher.publishAll(task.pullDomainEvents());
  }
}
