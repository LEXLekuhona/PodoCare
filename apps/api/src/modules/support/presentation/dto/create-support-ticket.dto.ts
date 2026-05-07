import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  subject!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsUUID()
  studioId?: string;
}

