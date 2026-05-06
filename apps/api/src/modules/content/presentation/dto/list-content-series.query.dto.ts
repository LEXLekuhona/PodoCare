import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContentAudience } from '@srs/shared-types';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListContentSeriesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  networkId?: string;

  @ApiPropertyOptional({ enum: ContentAudience })
  @IsOptional()
  @IsEnum(ContentAudience)
  audience?: ContentAudience;

  @ApiPropertyOptional({ enum: ['draft', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: 'draft' | 'published';

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip = 0;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take = 20;
}
