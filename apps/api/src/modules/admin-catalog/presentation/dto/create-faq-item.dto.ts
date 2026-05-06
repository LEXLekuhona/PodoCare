import { ApiPropertyOptional } from '@nestjs/swagger';
import { FaqCategory } from '@srs/shared-types';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFaqItemDto {
  @IsEnum(FaqCategory)
  category!: FaqCategory;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(8000)
  answer!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
