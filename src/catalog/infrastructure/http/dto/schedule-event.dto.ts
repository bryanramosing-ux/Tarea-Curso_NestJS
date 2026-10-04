import { IsDateString, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Validación de borde (nivel 1): forma y tipos del payload HTTP.
 * Las reglas de negocio (RN-001…RN-006) las aplica el dominio (nivel 2).
 */
export class ScheduleEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  venue: string;

  /** Fecha y hora ISO 8601, p. ej. 2027-03-20T21:00:00Z */
  @IsDateString({ strict: true })
  startsAt: string;

  @IsInt()
  capacity: number;

  @IsInt()
  priceCents: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  currency: string;
}
