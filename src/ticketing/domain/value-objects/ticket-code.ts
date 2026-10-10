import { InvalidTicketCodeError } from '../errors/ticketing.errors';

/** Sin caracteres ambiguos (0/O, 1/I/L) para poder dictarlo o teclearlo en la puerta. */
export const TICKET_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TICKET_CODE_GROUPS = 3;
export const TICKET_CODE_GROUP_LENGTH = 4;
const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;
const REDACTED = '[REDACTED]';

/**
 * RN-012: código secreto de una entrada (XXXX-XXXX-XXXX, 31^12 ≈ 2^59 combinaciones).
 * Los códigos nuevos los genera el puerto TicketCodeGenerator (azar del
 * sistema, en infraestructura); aquí solo se valida y normaliza el formato.
 * Quien lo tiene, entra: se muestra UNA vez al comprador y solo se guarda su
 * hash. `toString()`/`toJSON()` devuelven un marcador para que no aparezca
 * en logs; el valor solo se obtiene de forma explícita con `reveal()`.
 */
export class TicketCode {
  private constructor(private readonly secret: string) {}

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
