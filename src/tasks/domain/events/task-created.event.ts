import { DomainEvent } from '../../../shared/domain/domain-event';

export class TaskCreated implements DomainEvent {
  readonly eventName = 'tasks.task_created';

  constructor(
    public readonly taskId: string,
    public readonly title: string,
    public readonly priority: string,
    public readonly occurredOn: Date,
  ) {}
}
