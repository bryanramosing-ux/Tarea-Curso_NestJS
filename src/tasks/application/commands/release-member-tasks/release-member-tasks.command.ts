import { Command } from '@nestjs/cqrs';

export interface ReleaseMemberTasksResult {
  releasedTaskIds: string[];
}

/**
 * Caso de uso de escritura interno (sin endpoint): liberar las tareas no
 * terminadas de un miembro que dejó de estar disponible (RN-013).
 * Lo dispara el listener del evento UserDeactivated del contexto Users.
 */
export class ReleaseMemberTasksCommand extends Command<ReleaseMemberTasksResult> {
  constructor(public readonly memberId: string) {
    super();
  }
}
