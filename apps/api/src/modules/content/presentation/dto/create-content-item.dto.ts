import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentAudience, ContentFormat } from '@srs/shared-types';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import type { Prisma } from '@prisma/client';

export class CreateContentItemDto {
  @ApiProperty()
  @IsUUID()
  networkId!: string;

  @ApiProperty()
  @IsUUID()
  seriesId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @ApiProperty({ enum: ContentFormat })
  @IsEnum(ContentFormat)
  format!: ContentFormat;

  @ApiPropertyOptional({ enum: ContentAudience })
  @IsOptional()
  @IsEnum(ContentAudience)
  audience?: ContentAudience;

  @ApiProperty({ description: 'Тело материала (JSON по формату)' })
  @IsNotEmpty()
  body!: Prisma.InputJsonValue;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFreePreview?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    enum: ['draft', 'published'],
    default: 'draft',
    description:
      'Публикация единицы (контракт content.publicationState). В ленту попадают только опубликованные item + опубликованная серия.',
  })
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: 'draft' | 'published';
}
