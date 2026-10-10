import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

/** Check-in en la puerta: el evento de ESA puerta y el código que presenta el asistente (RN-016). */
export class CheckInDto {
  @IsUUID()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  code: string;
}
