import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DOMAIN_EVENT_PUBLISHER, DomainEventPublisher } from '../../../../shared/domain/ports/domain-event-publisher.port';
import { Task } from '../../../domain/entities/task';
import { TaskConcurrentModificationError } from '../../../domain/errors/task.errors';
import { TASK_REPOSITORY, TaskRepository } from '../../../domain/ports/task.repository';
import { AssigneeId } from '../../../domain/value-objects/assignee-id';
import { ReleaseMemberTasksCommand, ReleaseMemberTasksResult } from './release-member-tasks.command';

/** Intentos por tarea si otra operación la modifica en paralelo. */
export const RELEASE_MAX_ATTEMPTS = 3;

/**
 * RN-013. Esta operación no la pide un usuario sino un evento, así que no puede
 * devolver un 409 a nadie: si una tarea cambió en paralelo (bloqueo optimista),
 * se vuelve a leer y se reintenta, para que no quede trabajo asignado a un
 * miembro desactivado. Si tras releerla ya no es suya o ya está DONE, se omite.
 */
@CommandHandler(ReleaseMemberTasksCommand)
export class ReleaseMemberTasksHandler implements ICommandHandler<ReleaseMemberTasksCommand> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: ReleaseMemberTasksCommand): Promise<ReleaseMemberTasksResult> {
    const memberId = AssigneeId.create(command.memberId);
    const candidates = await this.tasks.findUnfinishedByAssignee(memberId);
    const released: Task[] = [];

    for (const candidate of candidates) {
      let task: Task | null = candidate;
      for (let attempt = 1; task && task.isAssignedTo(memberId) && !task.status.isDone(); attempt++) {
        task.releaseAssignee();
        try {
          await this.tasks.save(task);
          released.push(task);
          break;
        } catch (error) {
          if (!(error instanceof TaskConcurrentModificationError) || attempt >= RELEASE_MAX_ATTEMPTS) {
            throw error;
          }
          task = await this.tasks.findById(task.id);
        }
      }
    }

    await this.eventPublisher.publishAll(released.flatMap((task) => task.pullDomainEvents()));

    return { releasedTaskIds: released.map((task) => task.id.value) };
  }
}
