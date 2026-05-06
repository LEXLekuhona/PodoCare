import { NotificationTemplateKey, NotificationType } from '@srs/shared-types';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendSmsDto {
  @IsUUID()
  userId!: string;

  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsOptional()
  @IsEnum(NotificationTemplateKey)
  templateKey?: NotificationTemplateKey;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  senderId?: string;

  @IsOptional()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  idempotencyKey?: string;
}
