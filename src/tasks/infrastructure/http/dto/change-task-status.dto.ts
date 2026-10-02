import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** El valor y la transición (RN-009) los valida el dominio. */
export class ChangeTaskStatusDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  status: string;
}
