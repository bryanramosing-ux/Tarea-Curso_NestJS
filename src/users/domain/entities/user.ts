import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { InvalidUserTimestampsError, UserAlreadyInactiveError } from '../errors/user.errors';
import { UserDeactivated } from '../events/user-deactivated.event';
import { UserRegistered } from '../events/user-registered.event';
import { Email } from '../value-objects/email';
import { PasswordHash } from '../value-objects/password-hash';
import { UserId } from '../value-objects/user-id';
import { UserName } from '../value-objects/user-name';
import { UserStatus } from '../value-objects/user-status';

export interface UserPrimitives {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterUserProps {
  id: UserId;
  name: UserName;
  email: Email;
  passwordHash: PasswordHash;
}

/**
 * Agregado User (contexto Users): un miembro del equipo de la startup.
 * Solo cambia mediante métodos con intención de negocio; no hay setters.
 */
export class User extends AggregateRoot {
  private constructor(
    private readonly _id: UserId,
    private _name: UserName,
    private readonly _email: Email,
    private readonly _passwordHash: PasswordHash,
    private _status: UserStatus,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
    User.assertValidTimestamps(_createdAt, _updatedAt);
  }

  /** Alta de un miembro: nace ACTIVO y emite UserRegistered. */
  static register(props: RegisterUserProps, now: Date = new Date()): User {
    const user = new User(props.id, props.name, props.email, props.passwordHash, UserStatus.active(), now, now);
    user.record(new UserRegistered(user._id.value, user._email.value, user._name.value, now));
    return user;
  }

  /**
   * Reconstrucción desde persistencia. Vuelve a validar cada valor a través
   * de los value objects: un registro corrupto no produce un agregado válido.
   * No emite eventos (no es un hecho de negocio nuevo).
   */
  static fromPrimitives(primitives: UserPrimitives): User {
    return new User(
      UserId.create(primitives.id),
      UserName.create(primitives.name),
      Email.create(primitives.email),
      PasswordHash.create(primitives.passwordHash),
      UserStatus.create(primitives.status),
      primitives.createdAt,
      primitives.updatedAt,
    );
  }

  /** RN-005: solo un usuario activo puede desactivarse. */
  deactivate(now: Date = new Date()): void {
    if (!this._status.isActive()) {
      throw new UserAlreadyInactiveError(this._id.value);
    }
    this._status = UserStatus.inactive();
    this._updatedAt = now;
    this.record(new UserDeactivated(this._id.value, now));
  }

  isActive(): boolean {
    return this._status.isActive();
  }

  get id(): UserId {
    return this._id;
  }

  get name(): UserName {
    return this._name;
  }

  get email(): Email {
    return this._email;
  }

  get status(): UserStatus {
    return this._status;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  toPrimitives(): UserPrimitives {
    return {
      id: this._id.value,
      name: this._name.value,
      email: this._email.value,
      passwordHash: this._passwordHash.value,
      status: this._status.value,
      createdAt: new Date(this._createdAt),
      updatedAt: new Date(this._updatedAt),
    };
  }

  private static assertValidTimestamps(createdAt: Date, updatedAt: Date): void {
    if (
      !(createdAt instanceof Date) ||
      !(updatedAt instanceof Date) ||
      Number.isNaN(createdAt.getTime()) ||
      Number.isNaN(updatedAt.getTime()) ||
      updatedAt.getTime() < createdAt.getTime()
    ) {
      throw new InvalidUserTimestampsError();
    }
  }
}
