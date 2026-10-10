import { TicketCode } from '../value-objects/ticket-code';

export const TICKET_CODE_GENERATOR = Symbol('TICKET_CODE_GENERATOR');

/** RN-012: genera códigos de entrada impredecibles. El azar (CSPRNG) vive en infraestructura. */
export interface TicketCodeGenerator {
  generate(): TicketCode;
}
