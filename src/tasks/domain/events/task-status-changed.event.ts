import { DomainEvent } from '../../../shared/domain/domain-event';

export class TaskStatusChanged implements DomainEvent {
  readonly eventName = 'tasks.task_status_changed';

  constructor(
    public readonly taskId: string,
    public readonly from: string,
    public readonly to: string,
    public readonly occurredOn: Date,
  ) {}
}
