import { DomainEvent } from '../../../shared/domain/domain-event';

/** Un usuario fue desactivado y ya no puede tener trabajo asignado. */
export class UserDeactivated implements DomainEvent {
  readonly eventName = 'users.user_deactivated';

  constructor(
    public readonly userId: string,
    public readonly occurredOn: Date,
  ) {}
}
