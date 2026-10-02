import { DomainErrorKind, DomainException } from '../../../shared/domain/domain-exception';

export class InvalidTaskIdError extends DomainException {
  constructor(value: string) {
    super('TASK_INVALID_ID', DomainErrorKind.VALIDATION, `"${value}" is not a valid task id`);
  }
}

/** RN-006 */
export class InvalidTaskTitleError extends DomainException {
  constructor() {
    super('TASK_INVALID_TITLE', DomainErrorKind.VALIDATION, 'Task title must have between 3 and 120 characters');
  }
}

/** RN-007 */
export class InvalidTaskDescriptionError extends DomainException {
  constructor() {
    super('TASK_INVALID_DESCRIPTION', DomainErrorKind.VALIDATION, 'Task description must have at most 2000 characters');
  }
}

/** RN-009 */
export class InvalidTaskStatusError extends DomainException {
  constructor(value: string) {
    super(
      'TASK_INVALID_STATUS',
      DomainErrorKind.VALIDATION,
      `"${value}" is not a valid task status (TODO, IN_PROGRESS, IN_REVIEW, DONE)`,
    );
  }
}

/** RN-014 */
export class InvalidTaskPriorityError extends DomainException {
  constructor(value: string) {
    super('TASK_INVALID_PRIORITY', DomainErrorKind.VALIDATION, `"${value}" is not a valid task priority (LOW, MEDIUM, HIGH)`);
  }
}

export class InvalidAssigneeIdError extends DomainException {
  constructor(value: string) {
    super('TASK_INVALID_ASSIGNEE_ID', DomainErrorKind.VALIDATION, `"${value}" is not a valid assignee id`);
  }
}

/** Datos persistidos que violan las invariantes del agregado (RN-010, fechas). */
export class TaskInvariantViolationError extends DomainException {
  constructor(reason: string) {
    super('TASK_INVARIANT_VIOLATION', DomainErrorKind.VALIDATION, `Task state is invalid: ${reason}`);
  }
}

export class TaskNotFoundError extends DomainException {
  constructor(id: string) {
    super('TASK_NOT_FOUND', DomainErrorKind.NOT_FOUND, `Task "${id}" was not found`);
  }
}

/** RN-011 */
export class AssigneeNotFoundError extends DomainException {
  constructor(id: string) {
    super('TASK_ASSIGNEE_NOT_FOUND', DomainErrorKind.NOT_FOUND, `Team member "${id}" was not found`);
  }
}

/** RN-011 */
export class AssigneeInactiveError extends DomainException {
  constructor(id: string) {
    super('TASK_ASSIGNEE_INACTIVE', DomainErrorKind.CONFLICT, `Team member "${id}" is inactive and cannot receive tasks`);
  }
}

/** RN-009 */
export class InvalidStatusTransitionError extends DomainException {
  constructor(from: string, to: string) {
    super(
      'TASK_INVALID_STATUS_TRANSITION',
      DomainErrorKind.CONFLICT,
      `A task cannot move from ${from} to ${to}`,
    );
  }
}

/** RN-010 */
export class TaskRequiresAssigneeError extends DomainException {
  constructor(status: string) {
    super('TASK_REQUIRES_ASSIGNEE', DomainErrorKind.CONFLICT, `A task needs an assignee before moving to ${status}`);
  }
}

/** RN-012 */
export class TaskAlreadyDoneError extends DomainException {
  constructor(id: string) {
    super('TASK_ALREADY_DONE', DomainErrorKind.CONFLICT, `Task "${id}" is DONE and can no longer change`);
  }
}
