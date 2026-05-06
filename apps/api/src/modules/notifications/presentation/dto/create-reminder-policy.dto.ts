import { NotificationChannel, NotificationTemplateKey } from '@srs/shared-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateReminderPolicyDto {
  @IsUUID()
  networkId!: string;

  @IsEnum(NotificationTemplateKey)
  templateKey!: NotificationTemplateKey;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60 * 24 * 30)
  offsetMinutesBefore!: number;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
