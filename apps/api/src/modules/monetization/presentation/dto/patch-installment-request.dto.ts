import { ApiPropertyOptional } from '@nestjs/swagger';
import { InstallmentRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class PatchInstallmentRequestDto {
  @ApiPropertyOptional({ enum: InstallmentRequestStatus })
  @IsOptional()
  @IsEnum(InstallmentRequestStatus)
  status?: InstallmentRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  providerRequestId?: string | null;
}
