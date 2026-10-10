import { config as loadDotEnv } from 'dotenv';

/**
 * Se ejecuta antes de cada archivo e2e (setupFiles). Carga .env y sube los
 * límites de peticiones: las pruebas de concurrencia lanzan decenas de compras
 * desde la misma IP. process.env tiene prioridad sobre .env en ConfigModule.
 * El límite real se prueba aparte en rate-limit.e2e-spec.ts, con valores bajos.
 */
process.env.NODE_ENV = 'test'; // nunca la base de desarrollo (igual que global-setup.ts)
loadDotEnv();
process.env.THROTTLE_LIMIT = '100000';
process.env.THROTTLE_SENSITIVE_LIMIT = '100000';
