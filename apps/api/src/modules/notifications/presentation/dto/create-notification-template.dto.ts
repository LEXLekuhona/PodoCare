import { NotificationChannel, NotificationTemplateKey } from '@podocare/shared-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateNotificationTemplateDto {
  @IsUUID()
  networkId!: string;

  @IsEnum(NotificationTemplateKey)
  key!: NotificationTemplateKey;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MaxLength(3000)
  body!: string;

  @IsOptional()
  @Type(() => String)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  variables?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  senderId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
