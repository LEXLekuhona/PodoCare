import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, IsUUID, MaxLength, MinLength } from 'class-validator';

import { ACQUIRING_TERMINAL_PROVIDERS } from './create-acquiring-terminal.dto';

import type { PaymentProvider } from '@prisma/client';

export class UpdateAcquiringTerminalDto {
  @ApiPropertyOptional({ enum: ACQUIRING_TERMINAL_PROVIDERS })
  @IsOptional()
  @IsIn(ACQUIRING_TERMINAL_PROVIDERS)
  provider?: PaymentProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  publicId?: string;

  @ApiPropertyOptional({ description: 'Новый секрет; не передавать — оставить прежний' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  secret?: string;

  @ApiPropertyOptional({ description: 'Пусто (null) — сбросить привязку к студии (платформа)' })
  @IsOptional()
  @IsUUID()
  studioId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  notificationUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  deviceDataJson?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
