import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ListTasksQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}
