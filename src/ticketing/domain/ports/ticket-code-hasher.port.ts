import { TicketCode } from '../value-objects/ticket-code';
import { TicketCodeHash } from '../value-objects/ticket-code-hash';

export const TICKET_CODE_HASHER = Symbol('TICKET_CODE_HASHER');

/** RN-012: el algoritmo concreto de hashing del código vive en infraestructura. */
export interface TicketCodeHasher {
  hash(code: TicketCode): Promise<TicketCodeHash>;
}
