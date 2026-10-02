/**
 * Tipos de error de negocio. El dominio NO conoce códigos HTTP:
 * la traducción a HTTP ocurre en un único filtro de infraestructura
 * (src/shared/infrastructure/http/domain-exception.filter.ts).
 */
export const DomainErrorKind = {
  VALIDATION: 'VALIDATION',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
} as const;

export type DomainErrorKind = (typeof DomainErrorKind)[keyof typeof DomainErrorKind];

/**
 * Excepción base de todos los errores de negocio.
 * `code` es estable (contrato con los clientes) y `kind` clasifica el error.
 */
export abstract class DomainException extends Error {
  protected constructor(
    public readonly code: string,
    public readonly kind: DomainErrorKind,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
