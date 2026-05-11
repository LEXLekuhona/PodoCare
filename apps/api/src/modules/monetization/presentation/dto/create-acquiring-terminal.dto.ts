import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '@prisma/client';
import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, IsUUID, MaxLength, MinLength } from 'class-validator';

export const ACQUIRING_TERMINAL_PROVIDERS = [PaymentProvider.TINKOFF, PaymentProvider.YOOKASSA] as const;

export type AcquiringTerminalProvider = (typeof ACQUIRING_TERMINAL_PROVIDERS)[number];

export class CreateAcquiringTerminalDto {
  @ApiProperty({ enum: ACQUIRING_TERMINAL_PROVIDERS })
  @IsIn(ACQUIRING_TERMINAL_PROVIDERS)
  provider!: AcquiringTerminalProvider;

  @ApiProperty({ description: 'Человекочитаемое имя (для админки)' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @ApiProperty({ description: 'TerminalKey (Т‑Банк) или shopId (ЮKassa)' })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  publicId!: string;

  @ApiProperty({ description: 'Пароль терминала (Т‑Банк) или secret key (ЮKassa)' })
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  secret!: string;

  @ApiPropertyOptional({ description: 'Студия; не указывать — терминал уровня платформы' })
  @IsOptional()
  @IsUUID()
  studioId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  notificationUrl?: string;

  @ApiPropertyOptional({ description: 'Строка JSON для поля DATA (Т‑Банк), опционально' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  deviceDataJson?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
