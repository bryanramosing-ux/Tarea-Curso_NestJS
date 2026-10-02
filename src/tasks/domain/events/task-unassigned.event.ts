import { DomainEvent } from '../../../shared/domain/domain-event';

/** La tarea quedó sin responsable (RN-013) y volvió a la columna TODO. */
export class TaskUnassigned implements DomainEvent {
  readonly eventName = 'tasks.task_unassigned';

  constructor(
    public readonly taskId: string,
    public readonly previousAssigneeId: string,
    public readonly previousStatus: string,
    public readonly occurredOn: Date,
  ) {}
}
