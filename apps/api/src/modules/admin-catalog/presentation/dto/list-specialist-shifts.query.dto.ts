import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class ListSpecialistShiftsQueryDto {
  @ApiPropertyOptional({ description: 'Фильтр: смены, заканчивающиеся после этой даты (ISO UTC)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Фильтр: смены, начинающиеся до этой даты (ISO UTC)' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
