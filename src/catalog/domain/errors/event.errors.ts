import { DomainErrorKind, DomainException } from '../../../shared/domain/domain-exception';

export class InvalidEventIdError extends DomainException {
  constructor(value: string) {
    super('EVENT_INVALID_ID', DomainErrorKind.VALIDATION, `"${value}" is not a valid event id`);
  }
}

/** RN-001 */
export class InvalidEventNameError extends DomainException {
  constructor() {
    super('EVENT_INVALID_NAME', DomainErrorKind.VALIDATION, 'Event name must have between 3 and 120 characters');
  }
}

/** RN-002 */
export class InvalidVenueError extends DomainException {
  constructor() {
    super('EVENT_INVALID_VENUE', DomainErrorKind.VALIDATION, 'Venue must have between 2 and 120 characters');
  }
}

export class InvalidEventStartError extends DomainException {
  constructor() {
    super('EVENT_INVALID_START', DomainErrorKind.VALIDATION, 'Event start must be a valid ISO 8601 date and time with timezone (e.g. 2027-03-20T21:00:00Z)');
  }
}

/** RN-003 */
export class EventStartInPastError extends DomainException {
  constructor() {
    super('EVENT_START_IN_PAST', DomainErrorKind.VALIDATION, 'An event can only be scheduled in the future');
  }
}

/** RN-004 */
export class InvalidCapacityError extends DomainException {
  constructor() {
    super('EVENT_INVALID_CAPACITY', DomainErrorKind.VALIDATION, 'Capacity must be an integer between 1 and 100000');
  }
}

/** RN-005 */
export class InvalidTicketPriceError extends DomainException {
  constructor() {
    super(
      'EVENT_INVALID_PRICE',
      DomainErrorKind.VALIDATION,
      'Ticket price must be an integer amount of cents between 0 and 10000000 in PEN, USD or EUR',
    );
  }
}

export class InvalidEventStatusError extends DomainException {
  constructor(value: string) {
    super('EVENT_INVALID_STATUS', DomainErrorKind.VALIDATION, `"${value}" is not a valid event status (SCHEDULED, CANCELLED)`);
  }
}

/** Datos persistidos que violan las invariantes del agregado. */
export class EventInvariantViolationError extends DomainException {
  constructor(reason: string) {
    super('EVENT_INVARIANT_VIOLATION', DomainErrorKind.VALIDATION, `Event state is invalid: ${reason}`);
  }
}

export class EventNotFoundError extends DomainException {
  constructor(id: string) {
    super('EVENT_NOT_FOUND', DomainErrorKind.NOT_FOUND, `Event "${id}" was not found`);
  }
}

/** RN-006 */
export class EventSlotTakenError extends DomainException {
  constructor(venue: string, startsAt: Date) {
    super(
      'EVENT_SLOT_TAKEN',
      DomainErrorKind.CONFLICT,
      `Venue "${venue}" already has an event starting at ${startsAt.toISOString()}`,
    );
  }
}

/** RN-007 */
export class EventAlreadyCancelledError extends DomainException {
  constructor(id: string) {
    super('EVENT_ALREADY_CANCELLED', DomainErrorKind.CONFLICT, `Event "${id}" is already cancelled`);
  }
}

/** RN-007 */
export class EventAlreadyStartedError extends DomainException {
  constructor(id: string) {
    super('EVENT_ALREADY_STARTED', DomainErrorKind.CONFLICT, `Event "${id}" has already started and can no longer be cancelled`);
  }
}

/** Otra operación modificó el evento después de leerlo (bloqueo optimista). */
export class EventConcurrentModificationError extends DomainException {
  constructor(id: string) {
    super(
      'EVENT_CONCURRENT_MODIFICATION',
      DomainErrorKind.CONFLICT,
      `Event "${id}" was modified by another operation; reload it and try again`,
    );
  }
}
