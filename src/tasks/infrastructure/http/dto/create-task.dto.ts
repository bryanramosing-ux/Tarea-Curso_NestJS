import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Nivel 1 (borde): tipos y tamaños. RN-006, RN-007 y RN-014 las aplica el dominio. */
export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  priority?: string;
}
