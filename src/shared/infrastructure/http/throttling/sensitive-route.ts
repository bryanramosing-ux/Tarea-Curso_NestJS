import { ExecutionContext, SetMetadata } from '@nestjs/common';

export const SENSITIVE_ROUTE = 'throttling:sensitive-route';

/**
 * Marca una ruta "sensible" (compra, check-in): además del límite general de
 * peticiones por IP, se le aplica el límite estricto THROTTLE_SENSITIVE_LIMIT.
 */
export const SensitiveRoute = () => SetMetadata(SENSITIVE_ROUTE, true);

export function isSensitiveRoute(context: ExecutionContext): boolean {
  return Reflect.getMetadata(SENSITIVE_ROUTE, context.getHandler()) === true;
}
