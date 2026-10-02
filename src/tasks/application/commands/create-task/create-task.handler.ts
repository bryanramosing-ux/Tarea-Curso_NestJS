import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { Task } from '../../../domain/entities/task';
import { TASK_REPOSITORY, TaskRepository } from '../../../domain/ports/task.repository';
import { TaskDescription } from '../../../domain/value-objects/task-description';
import { TaskId } from '../../../domain/value-objects/task-id';
import { TaskPriority } from '../../../domain/value-objects/task-priority';
import { TaskTitle } from '../../../domain/value-objects/task-title';
import { CreateTaskCommand, CreateTaskResult } from './create-task.command';

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CreateTaskCommand): Promise<CreateTaskResult> {
    const task = Task.create({
      id: TaskId.generate(),
      title: TaskTitle.create(command.title),
      description: TaskDescription.create(command.description),
      priority: command.priority === undefined ? undefined : TaskPriority.create(command.priority),
    });

    await this.tasks.save(task);
    await this.eventPublisher.publishAll(task.pullDomainEvents());

    return { id: task.id.value };
  }
}
