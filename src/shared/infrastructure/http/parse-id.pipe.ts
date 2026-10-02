import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { REQUEST_VALIDATION_FAILED } from './validation.pipe';

/** Valida que el `:id` de la ruta sea un UUID, con el mismo formato de error que los DTOs. */
export function parseIdPipe(): ParseUUIDPipe {
  return new ParseUUIDPipe({
    exceptionFactory: () =>
      new BadRequestException({
        statusCode: 400,
        code: REQUEST_VALIDATION_FAILED,
        message: ['id must be a UUID'],
      }),
  });
}
