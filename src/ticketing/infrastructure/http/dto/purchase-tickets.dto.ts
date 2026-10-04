import { IsInt, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Validación de borde (nivel 1): forma y tipos del payload.
 * RN-008 (1–10 entradas) y RN-011 (titular) las aplica el dominio (nivel 2).
 */
export class PurchaseTicketsDto {
  @IsUUID()
  eventId: string;

  @IsInt()
  quantity: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  holderName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  holderEmail: string;
}
