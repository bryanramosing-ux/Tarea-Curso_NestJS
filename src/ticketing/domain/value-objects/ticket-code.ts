import { randomString } from '../../../shared/domain/uuid';
import { InvalidTicketCodeError } from '../errors/ticketing.errors';

/** Sin caracteres ambiguos (0/O, 1/I/L) para poder dictarlo o teclearlo en la puerta. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUPS = 3;
const GROUP_LENGTH = 4;
const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;
const REDACTED = '[REDACTED]';

/**
 * RN-012: código secreto de una entrada (XXXX-XXXX-XXXX, ~59 bits de azar).
 * Quien lo tiene, entra: se muestra UNA vez al comprador y solo se guarda su
 * hash. `toString()`/`toJSON()` devuelven un marcador para que no aparezca
 * en logs; el valor solo se obtiene de forma explícita con `reveal()`.
 */
export class TicketCode {
  private constructor(private readonly secret: string) {}

  static generate(): TicketCode {
    const groups = Array.from({ length: GROUPS }, () => randomString(GROUP_LENGTH, ALPHABET));
    return new TicketCode(groups.join('-'));
  }

  static create(value: string): TicketCode {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!CODE_PATTERN.test(normalized)) {
      throw new InvalidTicketCodeError();
    }
    return new TicketCode(normalized);
  }

  reveal(): string {
    return this.secret;
  }

  equals(other: TicketCode): boolean {
    return other instanceof TicketCode && this.secret === other.secret;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }
}
