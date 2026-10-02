import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, Max, Min, ValidateIf, validateSync } from 'class-validator';

export const NODE_ENVIRONMENTS = ['development', 'production', 'test'] as const;
export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

/**
 * Contrato de configuración. TODAS las variables son obligatorias y no hay
 * valores por defecto: si falta una, la aplicación (y el CLI de migraciones)
 * fallan al arrancar en lugar de conectarse a un destino equivocado.
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

  /** Solo obligatoria al ejecutar pruebas (NODE_ENV=test). */
  @ValidateIf((env: EnvironmentVariables) => env.NODE_ENV === 'test')
  @IsString()
  @IsNotEmpty()
  DB_NAME_TEST?: string;
}

/**
 * Valida el entorno. Los mensajes solo nombran variables, nunca sus valores,
 * para no filtrar secretos en la salida de error.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false, forbidUnknownValues: true });
  if (errors.length > 0) {
    const details = errors.flatMap((error) => Object.values(error.constraints ?? {})).join('\n  - ');
    throw new Error(`Invalid environment configuration (check your .env):\n  - ${details}`);
  }
  return env;
}
