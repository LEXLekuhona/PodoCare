import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TreatmentPlanStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { TreatmentPlanStepInputDto } from './treatment-plan-step.dto';

export class CreateTreatmentPlanDto {
  @ApiPropertyOptional({ description: 'ID визита, после которого создан план.' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiProperty({ description: 'Название плана лечения/ухода.' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'Дата начала действия плана (ISO).' })
  @IsDateString()
  validFrom!: string;

  @ApiPropertyOptional({ description: 'Дата окончания действия плана (ISO).' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ enum: TreatmentPlanStatus, default: TreatmentPlanStatus.ACTIVE })
  @IsOptional()
  @Type(() => String)
  @IsEnum(TreatmentPlanStatus)
  status?: TreatmentPlanStatus;

  @ApiPropertyOptional({ type: [String], description: 'Рекомендованные товары.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  recommendedPhysicalGoodIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Рекомендованные контент-серии.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  recommendedContentSeriesIds?: string[];

  @ApiPropertyOptional({ type: [TreatmentPlanStepInputDto], description: 'Этапы плана лечения.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TreatmentPlanStepInputDto)
  steps?: TreatmentPlanStepInputDto[];

  @ApiPropertyOptional({ description: 'Причина создания/изменения (для истории версий).' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Комментарий к плану (для истории версий).' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
