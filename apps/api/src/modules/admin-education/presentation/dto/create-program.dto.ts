import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsBoolean,
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

export class CreateProgramDto {
  @ApiProperty()
  @IsUUID()
  networkId!: string;

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
  @MaxLength(1000)
  subtitle?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  description!: string;

  @ApiProperty({ description: 'Длительность в днях' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationDays!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMinor!: number;

  @ApiPropertyOptional({ default: 'RUB' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  installmentAvailable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverImageUrl?: string;

  @ApiProperty({ description: 'Что входит — JSON (массив или объект)' })
  @IsNotEmpty()
  inclusions!: Prisma.InputJsonValue;

  @ApiProperty({ description: 'Этапы — JSON (массив или объект)' })
  @IsNotEmpty()
  stages!: Prisma.InputJsonValue;

  @ApiPropertyOptional({ description: 'FAQ — JSON' })
  @IsOptional()
  @Allow()
  faq?: Prisma.InputJsonValue;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
