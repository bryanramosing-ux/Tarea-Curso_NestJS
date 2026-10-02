import { DomainErrorKind, DomainException } from '../../../shared/domain/domain-exception';

export class InvalidUserIdError extends DomainException {
  constructor(value: string) {
    super('USER_INVALID_ID', DomainErrorKind.VALIDATION, `"${value}" is not a valid user id`);
  }
}

/** RN-001 */
export class InvalidEmailError extends DomainException {
  constructor() {
    super('USER_INVALID_EMAIL', DomainErrorKind.VALIDATION, 'Email must be a valid address of at most 254 characters');
  }
}

/** RN-003 */
export class InvalidUserNameError extends DomainException {
  constructor() {
    super('USER_INVALID_NAME', DomainErrorKind.VALIDATION, 'User name must have between 2 and 80 characters');
  }
}

/** RN-004 — el mensaje nunca incluye la contraseña. */
export class WeakPasswordError extends DomainException {
  constructor() {
    super(
      'USER_WEAK_PASSWORD',
      DomainErrorKind.VALIDATION,
      'Password must have between 8 and 72 characters and contain at least one letter and one digit',
    );
  }
}

export class InvalidPasswordHashError extends DomainException {
  constructor() {
    super('USER_INVALID_PASSWORD_HASH', DomainErrorKind.VALIDATION, 'Password hash is empty or malformed');
  }
}

export class InvalidUserStatusError extends DomainException {
  constructor(value: string) {
    super('USER_INVALID_STATUS', DomainErrorKind.VALIDATION, `"${value}" is not a valid user status`);
  }
}

export class InvalidUserTimestampsError extends DomainException {
  constructor() {
    super('USER_INVALID_TIMESTAMPS', DomainErrorKind.VALIDATION, 'User timestamps are invalid');
  }
}

/** RN-002 */
export class UserEmailAlreadyInUseError extends DomainException {
  constructor(email: string) {
    super('USER_EMAIL_ALREADY_IN_USE', DomainErrorKind.CONFLICT, `Email "${email}" is already registered`);
  }
}

export class UserNotFoundError extends DomainException {
  constructor(id: string) {
    super('USER_NOT_FOUND', DomainErrorKind.NOT_FOUND, `User "${id}" was not found`);
  }
}

/** RN-005 */
export class UserAlreadyInactiveError extends DomainException {
  constructor(id: string) {
    super('USER_ALREADY_INACTIVE', DomainErrorKind.CONFLICT, `User "${id}" is already inactive`);
  }
}
