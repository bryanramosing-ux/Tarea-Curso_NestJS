import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListEventsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}
