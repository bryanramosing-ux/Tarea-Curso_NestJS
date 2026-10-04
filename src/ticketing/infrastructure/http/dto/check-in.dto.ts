import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CheckInDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  code: string;
}
