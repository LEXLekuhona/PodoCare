import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListStaffQueryDto {
  @ApiPropertyOptional({ description: 'Фильтр по студии (SuperAdmin / NetworkOwner)' })
  @IsOptional()
  @IsUUID()
  studioId?: string;
}
