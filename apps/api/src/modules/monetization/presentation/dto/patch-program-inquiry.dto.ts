import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProgramInquiryStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class PatchProgramInquiryDto {
  @ApiPropertyOptional({ enum: ProgramInquiryStatus })
  @IsOptional()
  @IsEnum(ProgramInquiryStatus)
  status?: ProgramInquiryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedUserId?: string | null;

  @ApiPropertyOptional({ description: 'Комментарий в журнал заявки' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
