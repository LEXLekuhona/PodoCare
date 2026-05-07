import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentCtaTarget } from '@srs/shared-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** CTA у единицы контента (контракт content.cta): одна цель target + ровно одно target* поле. */
export class CreateContentCtaDto {
  @ApiProperty({ enum: ContentCtaTarget, description: 'Тип перехода (запись / программа / товар / …).' })
  @IsEnum(ContentCtaTarget)
  target!: ContentCtaTarget;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(140)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetProgramId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetSeriesId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetServiceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetPhysicalGoodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetQuizId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  targetExternalUrl?: string;
}
