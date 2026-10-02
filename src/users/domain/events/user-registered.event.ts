import { DomainEvent } from '../../../shared/domain/domain-event';

/** Un usuario quedó registrado. No transporta credenciales. */
export class UserRegistered implements DomainEvent {
  readonly eventName = 'users.user_registered';

  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly name: string,
    public readonly occurredOn: Date,
  ) {}
}
