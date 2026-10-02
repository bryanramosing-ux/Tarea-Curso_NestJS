import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Validación de borde (nivel 1): forma, tipos y tamaño máximo del payload.
 * Las reglas de negocio (RN-001 formato/normalización del email, RN-003
 * nombre, RN-004 política de contraseña) las aplica el dominio (nivel 2):
 * por eso aquí no se valida el formato del email, que el dominio normaliza
 * (trim + minúsculas) antes de validarlo.
 */
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}
