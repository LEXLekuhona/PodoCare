import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { STUDIO_DIRECTION_ICON_KEYS } from './studio-direction-icon-keys';

export class CreateStudioDirectionDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug: только строчные латинские буквы, цифры и дефисы',
  })
  @MinLength(2)
  @MaxLength(80)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @ApiProperty({ enum: STUDIO_DIRECTION_ICON_KEYS })
  @IsString()
  @IsIn([...STUDIO_DIRECTION_ICON_KEYS])
  iconKey!: string;

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
