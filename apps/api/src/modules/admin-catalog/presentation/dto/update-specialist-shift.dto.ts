import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export class UpdateSpecialistShiftDto {
  @ApiPropertyOptional({ description: 'Студия (если переносим смену в другую студию специалиста)' })
  @IsOptional()
  @IsUUID()
  studioId?: string;

  @ApiPropertyOptional({
    description: 'Начало смены в локальном времени студии (datetime-local), например 2026-05-07T10:00',
  })
  @IsOptional()
  @IsString()
  @Matches(DATETIME_LOCAL_RE)
  startsAtLocal?: string;

  @ApiPropertyOptional({
    description: 'Конец смены в локальном времени студии (datetime-local), например 2026-05-07T19:00',
  })
  @IsOptional()
  @IsString()
  @Matches(DATETIME_LOCAL_RE)
  endsAtLocal?: string;
}

