import { Command } from '@nestjs/cqrs';

/** Caso de uso de escritura: asignar (o reasignar) una tarea a un miembro. */
export class AssignTaskCommand extends Command<void> {
  constructor(
    public readonly taskId: string,
    public readonly assigneeId: string,
  ) {
    super();
  }
}
