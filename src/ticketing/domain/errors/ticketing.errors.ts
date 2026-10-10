import { DomainErrorKind, DomainException } from '../../../shared/domain/domain-exception';

/** Los mensajes de validación nunca repiten el valor recibido (no se refleja la entrada del cliente). */
export class InvalidTicketIdError extends DomainException {
  constructor() {
    super('TICKET_INVALID_ID', DomainErrorKind.VALIDATION, 'Ticket id must be a UUID');
  }
}

export class InvalidEventReferenceError extends DomainException {
  constructor() {
    super('TICKET_INVALID_EVENT_ID', DomainErrorKind.VALIDATION, 'Event id must be a UUID');
  }
}

/** RN-011 */
export class InvalidHolderNameError extends DomainException {
  constructor() {
    super('TICKET_INVALID_HOLDER_NAME', DomainErrorKind.VALIDATION, 'Holder name must have between 2 and 80 characters');
  }
}

/** RN-011 */
export class InvalidHolderEmailError extends DomainException {
  constructor() {
    super(
      'TICKET_INVALID_HOLDER_EMAIL',
      DomainErrorKind.VALIDATION,
      'Holder email must be a valid address of at most 254 characters',
    );
  }
}

/** RN-008 */
export class InvalidQuantityError extends DomainException {
  constructor() {
    super('TICKET_INVALID_QUANTITY', DomainErrorKind.VALIDATION, 'You can buy between 1 and 10 tickets per purchase');
  }
}

export class InvalidMoneyError extends DomainException {
  constructor() {
    super('TICKET_INVALID_MONEY', DomainErrorKind.VALIDATION, 'Money must be a non-negative integer amount of cents with an ISO currency');
  }
}

/** RN-012 — el mensaje nunca incluye el código recibido. */
export class InvalidTicketCodeError extends DomainException {
  constructor() {
    super('TICKET_INVALID_CODE', DomainErrorKind.VALIDATION, 'Ticket code must have the format XXXX-XXXX-XXXX');
  }
}

export class InvalidTicketCodeHashError extends DomainException {
  constructor() {
    super('TICKET_INVALID_CODE_HASH', DomainErrorKind.VALIDATION, 'Ticket code hash is malformed');
  }
}

export class InvalidTicketStatusError extends DomainException {
  constructor() {
    super('TICKET_INVALID_STATUS', DomainErrorKind.VALIDATION, 'Ticket status must be ISSUED, USED or REFUNDED');
  }
}

export class InvalidSalesStatusError extends DomainException {
  constructor() {
    super('TICKET_INVALID_SALES_STATUS', DomainErrorKind.VALIDATION, 'Sales status must be OPEN or CLOSED');
  }
}

/** La información recibida del catálogo no es utilizable para vender. */
export class InvalidSaleableEventError extends DomainException {
  constructor(reason: string) {
    super('TICKET_INVALID_EVENT_DATA', DomainErrorKind.VALIDATION, `Event data is not valid for sales: ${reason}`);
  }
}

/** Datos persistidos que violan las invariantes de un agregado. */
export class TicketingInvariantViolationError extends DomainException {
  constructor(reason: string) {
    super('TICKET_INVARIANT_VIOLATION', DomainErrorKind.VALIDATION, `Ticketing state is invalid: ${reason}`);
  }
}

export class EventNotAvailableForSaleError extends DomainException {
  constructor(id: string) {
    super('TICKET_EVENT_NOT_FOUND', DomainErrorKind.NOT_FOUND, `Event "${id}" was not found`);
  }
}

export class TicketNotFoundError extends DomainException {
  constructor(reference: string) {
    super('TICKET_NOT_FOUND', DomainErrorKind.NOT_FOUND, `Ticket ${reference} was not found`);
  }
}

/** RN-010 */
export class SalesClosedError extends DomainException {
  constructor(eventId: string) {
    super('TICKET_SALES_CLOSED', DomainErrorKind.CONFLICT, `Ticket sales for event "${eventId}" are closed`);
  }
}

/** RN-010 */
export class EventAlreadyStartedError extends DomainException {
  constructor(eventId: string) {
    super('TICKET_EVENT_ALREADY_STARTED', DomainErrorKind.CONFLICT, `Event "${eventId}" has already started`);
  }
}

/** RN-008: tope de entradas activas por titular (email) y evento. */
export class HolderTicketLimitExceededError extends DomainException {
  constructor(limit: number, alreadyHeld: number) {
    super(
      'TICKET_HOLDER_LIMIT_EXCEEDED',
      DomainErrorKind.CONFLICT,
      `A holder can have at most ${limit} active ticket(s) per event; this email already has ${alreadyHeld}`,
    );
  }
}

/** RN-009 */
export class NotEnoughTicketsError extends DomainException {
  constructor(requested: number, available: number) {
    super(
      'TICKET_NOT_ENOUGH_AVAILABLE',
      DomainErrorKind.CONFLICT,
      `Requested ${requested} ticket(s) but only ${available} available`,
    );
  }
}

/** RN-013 */
export class TicketAlreadyUsedError extends DomainException {
  constructor(id: string) {
    super('TICKET_ALREADY_USED', DomainErrorKind.CONFLICT, `Ticket "${id}" has already been used`);
  }
}

/** RN-013 */
export class TicketRefundedError extends DomainException {
  constructor(id: string) {
    super('TICKET_REFUNDED', DomainErrorKind.CONFLICT, `Ticket "${id}" was refunded and is no longer valid`);
  }
}

/** RN-016: la entrada es de otro evento (no se admite en esta puerta). */
export class TicketForAnotherEventError extends DomainException {
  constructor() {
    super('TICKET_WRONG_EVENT', DomainErrorKind.CONFLICT, 'This ticket belongs to a different event');
  }
}

/** RN-016: el evento de la entrada fue cancelado; la entrada no da acceso aunque aún no se haya reembolsado. */
export class TicketEventCancelledError extends DomainException {
  constructor(eventId: string) {
    super('TICKET_EVENT_CANCELLED', DomainErrorKind.CONFLICT, `Event "${eventId}" was cancelled; its tickets are not valid`);
  }
}

/** RN-016: todavía no se abren las puertas. */
export class CheckInNotOpenError extends DomainException {
  constructor(opensAt: Date) {
    super('TICKET_CHECK_IN_NOT_OPEN', DomainErrorKind.CONFLICT, `Check-in for this event opens at ${opensAt.toISOString()}`);
  }
}

/** RN-016: el plazo de acceso del evento ya terminó. */
export class CheckInClosedError extends DomainException {
  constructor(closedAt: Date) {
    super('TICKET_CHECK_IN_CLOSED', DomainErrorKind.CONFLICT, `Check-in for this event closed at ${closedAt.toISOString()}`);
  }
}

/** RN-014: solo se cierra la venta (y se reembolsa) de un evento cancelado. */
export class EventNotCancelledError extends DomainException {
  constructor(eventId: string) {
    super('TICKET_EVENT_NOT_CANCELLED', DomainErrorKind.CONFLICT, `Event "${eventId}" is not cancelled; its sales cannot be closed`);
  }
}

/** Otra operación modificó la entrada después de leerla (bloqueo optimista). */
export class TicketConcurrentModificationError extends DomainException {
  constructor(id: string) {
    super(
      'TICKET_CONCURRENT_MODIFICATION',
      DomainErrorKind.CONFLICT,
      `Ticket "${id}" was modified by another operation; reload it and try again`,
    );
  }
}

/** Otra compra modificó el aforo de venta a la vez (bloqueo optimista). */
export class SalesConcurrentModificationError extends DomainException {
  constructor(eventId: string) {
    super(
      'TICKET_SALES_CONCURRENT_MODIFICATION',
      DomainErrorKind.CONFLICT,
      `Ticket sales for event "${eventId}" changed while processing your purchase; try again`,
    );
  }
}
