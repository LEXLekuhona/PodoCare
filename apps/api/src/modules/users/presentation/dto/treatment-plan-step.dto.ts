import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TreatmentPlanStepStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class TreatmentPlanStepInputDto {
  @ApiProperty({ description: 'Название шага плана.' })
  @IsString()
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional({ description: 'Рекомендация/детали выполнения шага.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  recommendation?: string;

  @ApiPropertyOptional({ description: 'Контрольная дата выполнения шага (ISO).' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Текущий статус шага.',
    enum: TreatmentPlanStepStatus,
    default: TreatmentPlanStepStatus.PENDING,
  })
  @IsOptional()
  @Type(() => String)
  @IsEnum(TreatmentPlanStepStatus)
  status?: TreatmentPlanStepStatus;
}
