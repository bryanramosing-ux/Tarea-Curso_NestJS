import { Logger } from '@nestjs/common';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { UserDeactivated } from '../../../users/domain/events/user-deactivated.event';
import { ReleaseMemberTasksCommand } from '../../application/commands/release-member-tasks/release-member-tasks.command';

/**
 * Oyente EXTERNO (vive en infraestructura de Tasks): reacciona a un hecho
 * publicado por el contexto Users y lo traduce a un comando propio de Tasks.
 * Solo depende de la clase del evento (contrato publicado), nunca de la
 * entidad ni de los value objects de Users. RN-013.
 */
@EventsHandler(UserDeactivated)
export class ReleaseTasksOnUserDeactivatedListener implements IEventHandler<UserDeactivated> {
  private readonly logger = new Logger(ReleaseTasksOnUserDeactivatedListener.name);

  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: UserDeactivated): Promise<void> {
    try {
      const result = await this.commandBus.execute(new ReleaseMemberTasksCommand(event.userId));
      this.logger.log(`Released ${result.releasedTaskIds.length} task(s) of deactivated member ${event.userId}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Could not release tasks of member ${event.userId}: ${reason}`);
    }
  }
}
