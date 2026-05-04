import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ListStudiosQueryDto {
  @ApiPropertyOptional({ description: 'Фильтр по сети' })
  @IsOptional()
  @IsUUID()
  networkId?: string;
}
