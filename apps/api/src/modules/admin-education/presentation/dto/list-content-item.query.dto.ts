import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContentAudience, ContentFormat } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from './pagination-query.dto';

export class ListContentItemQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  networkId?: string;

  @ApiPropertyOptional({ description: 'Фильтр по серии' })
  @IsOptional()
  @IsUUID()
  seriesId?: string;

  @ApiPropertyOptional({ enum: ContentFormat })
  @IsOptional()
  @IsEnum(ContentFormat)
  format?: ContentFormat;

  @ApiPropertyOptional({ enum: ContentAudience })
  @IsOptional()
  @IsEnum(ContentAudience)
  audience?: ContentAudience;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;
}
