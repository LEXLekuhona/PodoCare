import { PushProvider } from '@srs/shared-types';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpsertPushDeviceDto {
  @IsUUID()
  userId!: string;

  @IsEnum(PushProvider)
  provider!: PushProvider;

  @IsString()
  @MaxLength(512)
  token!: string;

  @IsString()
  @MaxLength(50)
  deviceType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
