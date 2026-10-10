import { randomInt } from 'node:crypto';
import { TicketCodeGenerator } from '../../domain/ports/ticket-code-generator.port';
import {
  TICKET_CODE_ALPHABET,
  TICKET_CODE_GROUP_LENGTH,
  TICKET_CODE_GROUPS,
  TicketCode,
} from '../../domain/value-objects/ticket-code';

/**
 * Adaptador real del puerto TicketCodeGenerator: cada carácter sale de
 * `crypto.randomInt` (CSPRNG del sistema, sin sesgo de módulo), nunca de Math.random.
 */
export class CryptoTicketCodeGenerator implements TicketCodeGenerator {
  generate(): TicketCode {
    const group = () =>
      Array.from({ length: TICKET_CODE_GROUP_LENGTH }, () => TICKET_CODE_ALPHABET[randomInt(TICKET_CODE_ALPHABET.length)]).join('');
    return TicketCode.create(Array.from({ length: TICKET_CODE_GROUPS }, group).join('-'));
  }
}
