import { DomainEvent } from '../../../shared/domain/domain-event';

export class TaskAssigned implements DomainEvent {
  readonly eventName = 'tasks.task_assigned';

  constructor(
    public readonly taskId: string,
    public readonly assigneeId: string,
    public readonly previousAssigneeId: string | null,
    public readonly occurredOn: Date,
  ) {}
}
