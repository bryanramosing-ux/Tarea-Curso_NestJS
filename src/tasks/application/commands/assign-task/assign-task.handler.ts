import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { AssigneeNotFoundError, TaskNotFoundError } from '../../../domain/errors/task.errors';
import { TASK_REPOSITORY, TaskRepository } from '../../../domain/ports/task.repository';
import { TEAM_MEMBER_DIRECTORY, TeamMemberDirectory } from '../../../domain/ports/team-member-directory.port';
import { AssigneeId } from '../../../domain/value-objects/assignee-id';
import { TaskId } from '../../../domain/value-objects/task-id';
import { AssignTaskCommand } from './assign-task.command';

/**
 * Carga la tarea y el miembro (vía el puerto TeamMemberDirectory),
 * delega la decisión al agregado (RN-011, RN-012), persiste y publica.
 */
@CommandHandler(AssignTaskCommand)
export class AssignTaskHandler implements ICommandHandler<AssignTaskCommand> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository,
    @Inject(TEAM_MEMBER_DIRECTORY) private readonly teamMembers: TeamMemberDirectory,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: AssignTaskCommand): Promise<void> {
    const taskId = TaskId.create(command.taskId);
    const assigneeId = AssigneeId.create(command.assigneeId);

    const task = await this.tasks.findById(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId.value);
    }
    const member = await this.teamMembers.findById(assigneeId);
    if (!member) {
      throw new AssigneeNotFoundError(assigneeId.value);
    }

    task.assignTo(member);

    await this.tasks.save(task);
    await this.eventPublisher.publishAll(task.pullDomainEvents());
  }
}
