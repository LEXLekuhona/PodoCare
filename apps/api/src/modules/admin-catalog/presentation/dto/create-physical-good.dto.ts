import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePhysicalGoodDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  sku!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({ require_protocol: true }, { each: true })
  @MaxLength(2048, { each: true })
  imageUrls?: string[];

  /** Цена в рублях (целое число), в БД хранится как `priceMinor`. */
  @IsInt()
  @Min(0)
  @Type(() => Number)
  priceRubles!: number;

  @ApiPropertyOptional({ default: 'RUB' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
