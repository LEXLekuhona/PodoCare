import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelByClientDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
