import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { TASK_REPOSITORY, TaskRepository } from '../../../domain/ports/task.repository';
import { AssigneeId } from '../../../domain/value-objects/assignee-id';
import { ReleaseMemberTasksCommand, ReleaseMemberTasksResult } from './release-member-tasks.command';

@CommandHandler(ReleaseMemberTasksCommand)
export class ReleaseMemberTasksHandler implements ICommandHandler<ReleaseMemberTasksCommand> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: ReleaseMemberTasksCommand): Promise<ReleaseMemberTasksResult> {
    const memberId = AssigneeId.create(command.memberId);
    const tasks = await this.tasks.findUnfinishedByAssignee(memberId);

    for (const task of tasks) {
      task.releaseAssignee();
      await this.tasks.save(task);
    }
    await this.eventPublisher.publishAll(tasks.flatMap((task) => task.pullDomainEvents()));

    return { releasedTaskIds: tasks.map((task) => task.id.value) };
  }
}
