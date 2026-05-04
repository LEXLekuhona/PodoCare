import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListSpecialistsQueryDto {
  @ApiPropertyOptional({ description: 'Фильтр: специалист ведёт приём в этой студии' })
  @IsOptional()
  @IsUUID()
  studioId?: string;
}
