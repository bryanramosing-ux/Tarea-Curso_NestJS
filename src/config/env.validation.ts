import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsString, Max, Min, MinLength, ValidateIf, validateSync } from 'class-validator';

export const NODE_ENVIRONMENTS = ['development', 'production', 'test'] as const;
export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

/**
 * Marcador que llevan TODOS los valores de ejemplo de .env.example. Son
 * públicos (están en el repositorio): en producción se rechazan.
 */
export const EXAMPLE_VALUE_MARKER = 'change-me';

/** Variables secretas que nunca pueden quedarse con el valor de ejemplo en producción. */
const SECRET_VARIABLES = ['DB_PASSWORD', 'TICKET_CODE_SECRET', 'ORGANIZER_API_KEY', 'GATE_API_KEY'] as const;

/** Convierte "true"/"false" del .env en booleano; cualquier otra cosa queda tal cual y falla la validación. */
function toBoolean(value: unknown): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

/**
 * Contrato de configuración. TODAS las variables (salvo DB_NAME_TEST fuera de
 * las pruebas) son obligatorias y no hay valores por defecto: si falta una,
 * la aplicación (y el CLI de migraciones) fallan al arrancar en lugar de
 * conectarse a un destino equivocado o abrirse sin protección.
 */
export class EnvironmentVariables {
  @IsIn(NODE_ENVIRONMENTS)
  NODE_ENV: NodeEnvironment;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_USER: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  /**
   * Secreto del servidor para el HMAC de los códigos de entrada (RN-012).
   * Mínimo 32 caracteres; genera uno con:
   *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   */
  @IsString()
  @MinLength(32)
  TICKET_CODE_SECRET: string;

  /** Clave de API del rol ORGANIZER (programar/cancelar eventos, consultar entradas, conciliar). */
  @IsString()
  @MinLength(32)
  ORGANIZER_API_KEY: string;

  /** Clave de API del rol GATE (personal de puerta: check-in y consulta de entradas). */
  @IsString()
  @MinLength(32)
  GATE_API_KEY: string;

  /** Ventana del límite de peticiones, en segundos. */
  @IsInt()
  @Min(1)
  @Max(3600)
  THROTTLE_TTL_SECONDS: number;

  /** Peticiones por IP y ventana en cualquier ruta. */
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  THROTTLE_LIMIT: number;

  /** Peticiones por IP y ventana en las rutas sensibles (compra y check-in). */
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  THROTTLE_SENSITIVE_LIMIT: number;

  /**
   * true SOLO si la API está detrás de un proxy inverso de confianza (nginx,
   * balanceador): entonces la IP del cliente se toma de X-Forwarded-For. Con
   * false se usa la IP de la conexión (si se pusiera true sin proxy, cualquiera
   * podría falsear su IP y saltarse el límite de peticiones).
   */
  @IsBoolean()
  TRUST_PROXY: boolean;

  /** Solo obligatoria al ejecutar pruebas (NODE_ENV=test). */
  @ValidateIf((env: EnvironmentVariables) => env.NODE_ENV === 'test')
  @IsString()
  @IsNotEmpty()
  DB_NAME_TEST?: string;
}

/** Reglas que relacionan varias variables (class-validator valida cada una por separado). */
function crossFieldErrors(env: EnvironmentVariables): string[] {
  const errors: string[] = [];
  if (env.ORGANIZER_API_KEY && env.ORGANIZER_API_KEY === env.GATE_API_KEY) {
    errors.push('ORGANIZER_API_KEY and GATE_API_KEY must be different');
  }
  if (env.THROTTLE_SENSITIVE_LIMIT > env.THROTTLE_LIMIT) {
    errors.push('THROTTLE_SENSITIVE_LIMIT must not be greater than THROTTLE_LIMIT');
  }
  if (env.NODE_ENV === 'production') {
    for (const name of SECRET_VARIABLES) {
      if (String(env[name] ?? '').toLowerCase().includes(EXAMPLE_VALUE_MARKER)) {
        errors.push(`${name} still has the public example value from .env.example; generate a real secret for production`);
      }
    }
  }
  return errors;
}

/**
 * Valida el entorno. Los mensajes solo nombran variables, nunca sus valores,
 * para no filtrar secretos en la salida de error.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  // La conversión implícita haría Boolean("yes") === true (y Boolean("false") === true):
  // TRUST_PROXY se convierte a mano y cualquier valor que no sea true/false falla.
  env.TRUST_PROXY = toBoolean(config.TRUST_PROXY) as boolean;
  const errors = validateSync(env, { skipMissingProperties: false, forbidUnknownValues: true });
  const details = [...errors.flatMap((error) => Object.values(error.constraints ?? {})), ...(errors.length ? [] : crossFieldErrors(env))];
  if (details.length > 0) {
    throw new Error(`Invalid environment configuration (check your .env):\n  - ${details.join('\n  - ')}`);
  }
  return env;
}
