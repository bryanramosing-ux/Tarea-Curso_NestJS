import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

export const REQUEST_VALIDATION_FAILED = 'REQUEST_VALIDATION_FAILED';

function flatten(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const property = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) =>
      message.startsWith(error.property) ? message.replace(error.property, property) : message,
    );
    return [...own, ...flatten(error.children ?? [], property)];
  });
}

/**
 * Validación de borde (nivel 1). whitelist + forbidNonWhitelisted rechazan
 * propiedades desconocidas. Nunca se devuelven los valores recibidos
 * (podrían contener contraseñas), solo los mensajes de las restricciones.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors: ValidationError[]) =>
      new BadRequestException({
        statusCode: 400,
        code: REQUEST_VALIDATION_FAILED,
        message: flatten(errors),
      }),
  });
}
