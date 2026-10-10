import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/** Errores de cliente que lanza express/body-parser (http-errors): llevan `status` y `expose`. */
interface ClientHttpError {
  status: number;
  expose: boolean;
  type?: string;
}

function isClientHttpError(error: unknown): error is ClientHttpError {
  const candidate = error as Partial<ClientHttpError> | null;
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    candidate.expose === true &&
    typeof candidate.status === 'number' &&
    candidate.status >= 400 &&
    candidate.status < 500
  );
}

/**
 * Último recurso: cualquier error que no sea DomainException ni HttpException.
 *  - errores de cliente del propio express (p. ej. 413 cuerpo demasiado grande)
 *    se responden con su estado y SIN registrarlos como error del servidor;
 *  - todo lo demás es un fallo del servidor: se registra con su traza y el
 *    cliente recibe un 500 genérico (nunca detalles internos ni SQL).
 * Mantiene la forma { statusCode, code, message, path, timestamp }.
 */
@Catch()
export class UnhandledExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';

    if (isClientHttpError(exception)) {
      statusCode = exception.status;
      code = HttpStatus[statusCode] ?? 'BAD_REQUEST';
      message = statusCode === HttpStatus.PAYLOAD_TOO_LARGE ? 'Request body is too large' : 'Invalid request';
      this.logger.warn(`${request.method} ${request.path} -> ${statusCode} ${exception.type ?? ''}`.trim());
    } else {
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(`${request.method} ${request.path} -> ${error.name}: ${error.message}`, error.stack);
    }

    response.status(statusCode).json({ statusCode, code, message, path: request.url, timestamp: new Date().toISOString() });
  }
}
