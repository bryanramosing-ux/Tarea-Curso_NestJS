import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { EnvironmentVariables } from '../../../../config/env.validation';
import { isSensitiveRoute } from './sensitive-route';

type ThrottleSettings = Pick<EnvironmentVariables, 'THROTTLE_TTL_SECONDS' | 'THROTTLE_LIMIT' | 'THROTTLE_SENSITIVE_LIMIT'>;

/**
 * Límite de peticiones por IP y por ruta (en memoria del proceso; cada ruta
 * lleva su propio contador):
 *  - `default`: cualquier ruta, THROTTLE_LIMIT peticiones por ventana;
 *  - `sensitive`: solo compra y check-in, THROTTLE_SENSITIVE_LIMIT por ventana
 *    (frena a quien intenta agotar el aforo o probar códigos de entrada).
 * Al superarlo se responde 429 TOO_MANY_REQUESTS.
 */
export function buildThrottlerOptions(settings: ThrottleSettings): ThrottlerModuleOptions {
  const ttl = settings.THROTTLE_TTL_SECONDS * 1000;
  return {
    throttlers: [
      { name: 'default', ttl, limit: settings.THROTTLE_LIMIT },
      {
        name: 'sensitive',
        ttl,
        limit: settings.THROTTLE_SENSITIVE_LIMIT,
        skipIf: (context) => !isSensitiveRoute(context),
      },
    ],
  };
}
