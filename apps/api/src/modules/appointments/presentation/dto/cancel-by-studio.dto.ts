import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelByStudioDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
