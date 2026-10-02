import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainErrorKind, DomainException } from '../../domain/domain-exception';

/** Única traducción DomainErrorKind -> HTTP de toda la aplicación. */
export function httpStatusFor(kind: DomainErrorKind): HttpStatus {
  switch (kind) {
    case DomainErrorKind.VALIDATION:
      return HttpStatus.BAD_REQUEST;
    case DomainErrorKind.NOT_FOUND:
      return HttpStatus.NOT_FOUND;
    case DomainErrorKind.CONFLICT:
      return HttpStatus.CONFLICT;
    default: {
      const unreachable: never = kind;
      throw new Error(`Unmapped domain error kind: ${String(unreachable)}`);
    }
  }
}

/**
 * Filtro de infraestructura: convierte cualquier DomainException en una
 * respuesta HTTP con código estable. Un error de negocio nunca termina en 500.
 */
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const statusCode = httpStatusFor(exception.kind);

    response.status(statusCode).json({
      statusCode,
      code: exception.code,
      message: exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
