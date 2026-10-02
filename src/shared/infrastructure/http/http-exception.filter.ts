import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

const CODE_BY_STATUS: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.NOT_FOUND]: 'ROUTE_NOT_FOUND',
};

/**
 * Errores del propio framework (JSON mal formado, ruta inexistente, fallo de
 * un pipe...). No son errores de dominio: esos los traduce únicamente
 * DomainExceptionFilter. Este filtro solo homogeneiza la forma de la
 * respuesta para que el cliente reciba siempre { statusCode, code, message }.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const statusCode = exception.getStatus();
    const body = exception.getResponse();
    const details = typeof body === 'object' && body !== null ? (body as { code?: unknown; message?: unknown }) : {};

    response.status(statusCode).json({
      statusCode,
      code:
        typeof details.code === 'string'
          ? details.code
          : (CODE_BY_STATUS[statusCode] ?? HttpStatus[statusCode] ?? 'HTTP_ERROR'),
      message: details.message ?? exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
