import { createHmac } from 'node:crypto';
import { TicketCodeHasher } from '../../domain/ports/ticket-code-hasher.port';
import { TicketCode } from '../../domain/value-objects/ticket-code';
import { TicketCodeHash } from '../../domain/value-objects/ticket-code-hash';

const MIN_SECRET_LENGTH = 32;

/**
 * Adaptador del puerto TicketCodeHasher: HMAC-SHA256 con un secreto del servidor
 * (TICKET_CODE_SECRET). El código ya es aleatorio (~59 bits), por eso no hace
 * falta un hash lento como scrypt; el secreto impide que alguien con una copia
 * de la base pueda calcular hashes de códigos candidatos para colarse.
 * Es determinista para poder buscar la entrada por su hash en la puerta.
 */
export class HmacTicketCodeHasher implements TicketCodeHasher {
  constructor(private readonly secret: string) {
    if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
      throw new Error(`TICKET_CODE_SECRET must have at least ${MIN_SECRET_LENGTH} characters`);
    }
  }

  async hash(code: TicketCode): Promise<TicketCodeHash> {
    return TicketCodeHash.create(createHmac('sha256', this.secret).update(code.reveal()).digest('hex'));
  }
}
